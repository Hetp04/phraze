const admin = require("firebase-admin");
const {onCall} = require("firebase-functions/v2/https");
const {onValueCreated} = require("firebase-functions/v2/database");
const {onSchedule} = require("firebase-functions/v2/scheduler");

admin.initializeApp();

const normalizeEmailToKey = (email) => {
  if (!email) return null;
  return String(email).replace(/\./g, ",").toLowerCase();
};

const parseChatIdFromTopic = (topic) => {
  if (!topic || typeof topic !== "string") return null;
  if (!topic.startsWith("groqChats-")) return null;
  return topic.replace("groqChats-", "");
};

const isActiveConversationOpen = async (
    userEmailKey,
    projectId,
    chatId,
    expectedContactKey,
) => {
  try {
    if (!userEmailKey || !chatId || !expectedContactKey) return false;

    const ctxRef = admin
        .database()
        .ref(`activeMessagingContext/${String(userEmailKey).toLowerCase()}`);
    const snap = await ctxRef.get();
    if (!snap.exists()) return false;

    const ctx = snap.val() || {};
    if (!ctx.chatId || String(ctx.chatId) !== String(chatId)) return false;
    if (
      ctx.projectId &&
      projectId &&
      String(ctx.projectId) !== String(projectId)
    ) {
      return false;
    }
    if (
      !ctx.contactKey ||
      String(ctx.contactKey).toLowerCase() !==
        String(expectedContactKey).toLowerCase()
    ) {
      return false;
    }

    // Staleness guard: if client disappears without cleanup,
    // don't suppress forever.
    const updatedAt = Number(ctx.updatedAt || 0);
    const ageMs = Date.now() - updatedAt;
    if (!updatedAt || ageMs > 2 * 60 * 1000) return false;
    return true;
  } catch (e) {
    return false;
  }
};

const incrementMissedForContact = async ({
  userEmailKey,
  chatId,
  contactKey,
}) => {
  if (!userEmailKey || !chatId || !contactKey) return;

  const base = `userChatState/${userEmailKey}/${chatId}`;
  const contactCountRef = admin
      .database()
      .ref(`${base}/contacts/${contactKey}/missedCount`);
  const chatSumRef = admin.database().ref(`${base}/missedCount`);

  await contactCountRef.transaction((cur) => (Number(cur || 0) + 1));
  await chatSumRef.transaction((cur) => (Number(cur || 0) + 1));
};

exports.checkEmailProviders = onCall(async (request) => {
  const email = request.data.email;

  if (!email) {
    throw new Error("Email required");
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    return {
      exists: true,
      providers: user.providerData.map((p) => p.providerId),
    };
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      return {exists: false};
    }
    throw err;
  }
});

// Group chat (everyone) messages
// Companies/{companyEmail}/securedProjects/{projectId}/messages/{topic}/
// everyone/{messageId}
exports.onEveryoneMessageCreated = onValueCreated(
    {
      ref: [
        "Companies/{companyEmail}/securedProjects/{projectId}/messages/",
        "{topic}/everyone/{messageId}",
      ].join(""),
    },
    async (event) => {
      const msg = event.data.val();
      if (!msg) return;

      const companyEmail = event.params.companyEmail;
      const projectId = event.params.projectId;
      const topic = event.params.topic;
      const chatId = parseChatIdFromTopic(topic);
      if (!chatId) return;

      const fromEmailKey = normalizeEmailToKey(msg.email);
      if (!fromEmailKey) return;

      // Members live under Companies/{companyEmail}/projects/{projectId}/
      // members
      const membersSnap = await admin
          .database()
          .ref(`Companies/${companyEmail}/projects/${projectId}/members`)
          .get();

      if (!membersSnap.exists()) return;
      const members = membersSnap.val() || {};

      const updates = [];
      for (const memberKey of Object.keys(members)) {
        const memberUserKey = String(memberKey || "").toLowerCase();
        if (
          !memberUserKey ||
        memberUserKey === String(fromEmailKey).toLowerCase()
        ) {
          continue;
        }

        const suppress = await isActiveConversationOpen(
            memberUserKey,
            projectId,
            chatId,
            "everyone",
        );
        if (suppress) continue;

        updates.push(
            incrementMissedForContact({
              userEmailKey: memberUserKey,
              chatId,
              contactKey: "everyone",
            }),
        );
      }

      await Promise.all(updates);
    },
);

// Private 1:1 messages
// privateMessages/{emailPair}/{ownerCompany}/{projectId}/{topic}/{messageId}
exports.onPrivateMessageCreated = onValueCreated(
    {
      ref: [
        "privateMessages/{emailPair}/{ownerCompany}/{projectId}/",
        "{topic}/{messageId}",
      ].join(""),
    },
    async (event) => {
      const msg = event.data.val();
      if (!msg) return;

      const emailPair = event.params.emailPair;
      const projectId = event.params.projectId;
      const topic = event.params.topic;
      const chatId = parseChatIdFromTopic(topic);
      if (!chatId) return;

      const fromEmailKey = normalizeEmailToKey(msg.email);
      if (!fromEmailKey) return;

      const parts = String(emailPair).split("-");
      if (parts.length !== 2) return;
      const a = String(parts[0]).toLowerCase();
      const b = String(parts[1]).toLowerCase();

      let recipientKey = null;
      if (fromEmailKey === a) recipientKey = b;
      else if (fromEmailKey === b) recipientKey = a;
      else return;

      const suppress = await isActiveConversationOpen(
          recipientKey,
          projectId,
          chatId,
          fromEmailKey,
      );
      if (suppress) return;

      await incrementMissedForContact({
        userEmailKey: recipientKey,
        chatId,
        contactKey: fromEmailKey,
      });
    },
);

// Topic group chat creation
// Companies/{companyEmail}/topicGroupChats/{topic}/{groupId}
// Fan-out membership index:
// Companies/{companyEmail}/topicGroupChatMembership/{topic}/{userEmailKey}/
// {groupId}
exports.onTopicGroupChatCreated = onValueCreated(
    {
      ref: "Companies/{companyEmail}/topicGroupChats/{topic}/{groupId}",
    },
    async (event) => {
      try {
        const group = event.data.val();
        if (!group || typeof group !== "object") return;

        const companyEmail = event.params.companyEmail;
        const topic = event.params.topic;
        const groupId = event.params.groupId;

        const members = group.members || {};
        if (!members || typeof members !== "object") return;

        const name = group.name || "Group chat";
        const updates = {};
        const now = Date.now();

        Object.keys(members).forEach((memberKeyRaw) => {
          const memberKey = String(memberKeyRaw || "").toLowerCase();
          if (!memberKey) return;
          const memberPath = [
            "Companies",
            companyEmail,
            "topicGroupChatMembership",
            topic,
            memberKey,
            groupId,
          ].join("/");
          updates[memberPath] = {
            joinedAt: now,
            name,
          };
        });

        if (Object.keys(updates).length === 0) return;
        await admin.database().ref().update(updates);
      } catch (e) {
        console.error("onTopicGroupChatCreated error:", e);
      }
    },
);

// Topic group chat messages
// Companies/{companyEmail}/topicGroupChatMessages/{topic}/{groupId}/{messageId}
exports.onTopicGroupChatMessageCreated = onValueCreated(
    {
      ref: [
        "Companies/{companyEmail}/topicGroupChatMessages/{topic}/",
        "{groupId}/{messageId}",
      ].join(""),
    },
    async (event) => {
      const msg = event.data.val();
      if (!msg) return;

      const companyEmail = event.params.companyEmail;
      const topic = event.params.topic;
      const groupId = event.params.groupId;
      const chatId = parseChatIdFromTopic(topic);
      if (!chatId) return;

      const fromEmailKey = normalizeEmailToKey(msg.email);
      if (!fromEmailKey) return;

      // Members live on the group record
      const groupSnap = await admin
          .database()
          .ref(`Companies/${companyEmail}/topicGroupChats/${topic}/${groupId}`)
          .get();
      if (!groupSnap.exists()) return;
      const group = groupSnap.val() || {};
      const members = group.members || {};
      if (!members || typeof members !== "object") return;

      const contactKey = `group:${String(groupId || "").toLowerCase()}`;
      const updates = [];

      for (const memberKeyRaw of Object.keys(members)) {
        const memberUserKey = String(memberKeyRaw || "").toLowerCase();
        if (!memberUserKey) continue;
        if (memberUserKey === String(fromEmailKey).toLowerCase()) continue;

        // We don't have projectId on this path; suppression is based on
        // chatId + contactKey.
        const suppress = await isActiveConversationOpen(
            memberUserKey,
            null,
            chatId,
            contactKey,
        );
        if (suppress) continue;

        updates.push(
            incrementMissedForContact({
              userEmailKey: memberUserKey,
              chatId,
              contactKey,
            }),
        );
      }

      await Promise.all(updates);
    },
);

// Cloud Scheduler function to process and send due scheduled messages
exports.processScheduledMessages = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "America/New_York",
  timeoutSeconds: 540,
}, async () => {
  try {
    const now = Date.now();
    const scheduledRef = admin.database().ref("scheduledMessages");
    const dueQuery = scheduledRef
        .orderByChild("scheduledAt")
        .endAt(now)
        .limitToLast(50);
    const snapshot = await dueQuery.once("value");
    const due = snapshot.val() || {};
    const results = [];

    for (const scheduledId of Object.keys(due)) {
      const scheduled = due[scheduledId];
      if (!scheduled || scheduled.status === "sent") continue;

      const {
        text,
        email,
        name,
        scheduledAt,
        projectId,
        topic,
        emailPair,
        ownerCompany,
      } = scheduled;

      // Build target path (same logic as handleSendMessage)
      let targetPath;
      if (emailPair === "everyone") {
        targetPath = `Companies/${ownerCompany}/securedProjects/` +
            `${projectId}/messages/${topic}/everyone/${scheduledAt}`;
      } else {
        targetPath = `privateMessages/${emailPair}/${ownerCompany}/` +
            `${projectId}/${topic}/${scheduledAt}`;
      }

      const messagePayload = {
        text,
        email,
        name,
        timestamp: new Date(scheduledAt).toISOString(),
        messageId: scheduledAt.toString(),
        reactions: {},
        editedAt: null,
        isScheduled: false,
        replyTo: scheduled.replyTo || null,
      };

      await admin.database().ref(targetPath).set(messagePayload);
      await admin.database().ref(`scheduledMessages/${scheduledId}`).remove();

      results.push({scheduledId, targetPath, success: true});
    }

    console.log("processScheduledMessages processed:", {
      processedAt: new Date().toISOString(),
      count: results.length,
    });
  } catch (err) {
    console.error("processScheduledMessages error:", err);
  }
});
