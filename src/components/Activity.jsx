import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../firebase-init';
import { getFirebaseData, saveFirebaseData } from '../funcs';
import { auth } from '../firebase-init';
import MinimalistAreaChart from './AreaChart';
import { listenToUserPresence, getPresenceColor, getPresenceLabel } from '../utils/presence';

// Helper function to get resolved company email (supports shared projects)
const getResolvedCompanyEmail = async () => {
  // Check for shared project first (when viewing another user's shared project)
  const sharedCompanyEmail = localStorage.getItem("sharedCompanyEmail");
  const sharedProjectId = localStorage.getItem("sharedProjectId");
  const currentProject = localStorage.getItem("currentProject") || 'default';

  // Only use sharedCompanyEmail if the current project matches the stored shared project
  if (sharedCompanyEmail && sharedProjectId && sharedProjectId === currentProject) {
    return sharedCompanyEmail.replace(/\./g, ',');
  }

  // Try local cache for user's own company
  const companyEmail = localStorage.getItem("companyEmail");
  if (companyEmail) {
    return companyEmail.replace(/\./g, ',');
  }

  try {
    // Fallback: map current user email to company in Firebase
    const user = JSON.parse(localStorage.getItem("currentUser"));
    const rawEmail = user && user.email ? user.email : null;
    if (!rawEmail) return null;
    const emailKey = rawEmail.replace(/\./g, ',');
    const { getFirebaseData } = await import('../funcs');
    const mapped = await getFirebaseData(`emailToCompanyDirectory/${emailKey}`);
    if (mapped) {
      try { localStorage.setItem("companyEmail", mapped); } catch (_) { }
      return mapped.replace(/\./g, ',');
    }
  } catch (_) { }

  return null;
};

// Helper function to get current project
const getCurrentProject = () => {
  return localStorage.getItem("currentProject") || 'default';
};

const Activity = ({ currentProject, onViewMember, isExpanded, onToggleExpand, renderCommentsContent }) => {
  const getStoredBoxHeight = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      const n = raw ? Number(raw) : NaN;
      if (!Number.isFinite(n)) return fallback;
      return n;
    } catch (_) {
      return fallback;
    }
  };

  const exportResolvePerson = (p) => {
    const emailRaw = p && p.email ? String(p.email) : '';
    const email = emailRaw ? emailRaw.toLowerCase() : '';
    const member = email ? memberByEmail.get(email) : null;
    const firstName = (p && p.firstName) || (member && member.firstName) || '';
    const lastName = (p && p.lastName) || (member && member.lastName) || '';
    const name = (member && member.name) || (p && p.name) || (emailRaw || '');
    const profilePic = (member && member.profilePic) || null;
    const ts = (p && p.ts) || '';
    return { email: emailRaw, firstName, lastName, name, profilePic, ts };
  };

  const exportResolvePeopleList = (list) => {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((p) => {
      const email = p && p.email ? String(p.email).toLowerCase() : '';
      if (!email || seen.has(email)) return;
      if (!memberByEmail.has(email)) return;
      seen.add(email);
      out.push(exportResolvePerson(p));
    });
    out.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));
    return out;
  };

  const exportResolveHistoryItems = (items) => {
    return (Array.isArray(items) ? items : []).map((item) => {
      const createdBy = item && item.createdBy ? exportResolvePerson(item.createdBy) : null;
      const modifiedBy = exportResolvePeopleList(item && item.modifiedBy ? item.modifiedBy : []);
      return {
        ...item,
        createdBy,
        modifiedBy
      };
    });
  };

  const setStoredBoxHeight = (key, value) => {
    try {
      localStorage.setItem(key, String(value));
    } catch (_) { }
  };

  const clampHeight = (nextHeight) => {
    const min = 140;
    const max = Math.min(820, Math.max(220, window.innerHeight - 140));
    return Math.max(min, Math.min(max, nextHeight));
  };

  const clampHistoryFullscreenListHeight = (nextHeight) => {
    const min = 180;
    const max = Math.min(720, Math.max(260, window.innerHeight - 260));
    return Math.max(min, Math.min(max, Number(nextHeight) || 0));
  };

  const beginResizeHeight = (e, { boxId, storageKey, setHeight, boxRef, edge, startHeightOverride }) => {
    e.preventDefault();
    e.stopPropagation();

    const startY = e.clientY;
    const startHeight = Number.isFinite(Number(startHeightOverride))
      ? Number(startHeightOverride)
      : (boxRef?.current
        ? boxRef.current.getBoundingClientRect().height
        : 0);

    const minH = 140;

    const getMaxAllowedHeightForKey = (key) => {
      return null;
    };

    const getNeighborForEdge = () => {
      if (!boxId) return null;
      const order = Array.isArray(boxOrder) ? boxOrder : [];
      const idx = order.indexOf(String(boxId));
      if (idx < 0) return null;

      // For chained resizing, we consider collapsed boxes as well; otherwise the divider
      // "snaps back" because the neighbor isn't participating.
      const isParticipating = (id) => {
        if (Boolean(isHistoryFullscreen)) return false;
        if (id === 'history') return true;
        if (id === 'stats') return true;
        if (id === 'members') return true;
        if (id === 'activity') return true;
        return false;
      };

      const step = edge === 'top' ? -1 : 1;
      let j = idx + step;
      while (j >= 0 && j < order.length) {
        const candidate = String(order[j]);
        if (isParticipating(candidate)) return candidate;
        j += step;
      }
      return null;
    };

    const neighborId = getNeighborForEdge();
    const getBoxMeta = (id) => {
      if (id === 'history') return {
        storageKey: 'sidebarBoxHeight:annotationHistory',
        setHeight: setHistoryBoxHeight,
        boxRef: historyBoxRef,
        isVisible: Boolean(isHistoryVisible),
        setVisible: setIsHistoryVisible,
        storedHeight: historyBoxHeight
      };
      if (id === 'stats') return {
        storageKey: 'sidebarBoxHeight:annotationStats',
        setHeight: setStatsBoxHeight,
        boxRef: statsBoxRef,
        isVisible: Boolean(isStatsVisible),
        setVisible: setIsStatsVisible,
        storedHeight: statsBoxHeight
      };
      if (id === 'members') return {
        storageKey: 'sidebarBoxHeight:projectMembers',
        setHeight: setMembersBoxHeight,
        boxRef: membersBoxRef,
        isVisible: Boolean(isMembersVisible),
        setVisible: setIsMembersVisible,
        storedHeight: membersBoxHeight
      };
      if (id === 'activity') return {
        storageKey: 'sidebarBoxHeight:activity',
        setHeight: setActivityBoxHeight,
        boxRef: activityBoxRef,
        isVisible: Boolean(showActivityBody),
        setVisible: setShowActivityBody,
        storedHeight: activityBoxHeight
      };
      return null;
    };

    const neighborMeta = neighborId ? getBoxMeta(neighborId) : null;
    // If neighbor is collapsed, expand it so it participates in chained resizing.
    // Use stored height as baseline immediately (state updates are async).
    if (neighborMeta && !neighborMeta.isVisible && typeof neighborMeta.setVisible === 'function') {
      neighborMeta.setVisible(true);
    }
    const neighborStartHeight = neighborMeta
      ? (neighborMeta.isVisible && neighborMeta?.boxRef?.current
        ? neighborMeta.boxRef.current.getBoundingClientRect().height
        : Number(neighborMeta.storedHeight))
      : null;

    const selfMaxAllowedHeight = getMaxAllowedHeightForKey(storageKey);
    const neighborMaxAllowedHeight = neighborMeta ? getMaxAllowedHeightForKey(neighborMeta.storageKey) : null;

    const shouldContentCapMax = storageKey === 'sidebarBoxHeight:projectMembers';
    const contentMaxAtStartRaw = shouldContentCapMax && boxRef?.current
      ? boxRef.current.scrollHeight
      : null;
    const contentMaxAtStart = Number.isFinite(Number(contentMaxAtStartRaw))
      ? Math.max(minH, Number(contentMaxAtStartRaw))
      : null;

    let rafId = null;
    let pendingSelf = null;
    let pendingNeighbor = null;
    let latestNeighborHeight = null;

    let latestHeight = startHeight;

    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const onMove = (ev) => {
      const delta = ev.clientY - startY;
      const currRaw = edge === 'top' ? (startHeight - delta) : (startHeight + delta);
      let next = clampHeight(currRaw);
      if (selfMaxAllowedHeight != null) {
        let effectiveMax = selfMaxAllowedHeight;
        if (shouldContentCapMax && contentMaxAtStart != null) {
          effectiveMax = Math.min(effectiveMax, contentMaxAtStart);
        }
        next = Math.min(next, effectiveMax);
      }
      latestHeight = next;

      pendingSelf = next;

      // Chain resize: move the shared boundary by resizing the adjacent visible box inversely.
      pendingNeighbor = null;
      latestNeighborHeight = null;
      if (neighborMeta && Number.isFinite(Number(neighborStartHeight))) {
        const neighborRaw = edge === 'top'
          ? (Number(neighborStartHeight) + delta)
          : (Number(neighborStartHeight) - delta);
        let neighborNext = clampHeight(neighborRaw);
        if (neighborMaxAllowedHeight != null) neighborNext = Math.min(neighborNext, neighborMaxAllowedHeight);
        neighborNext = Math.max(minH, neighborNext);
        pendingNeighbor = neighborNext;
        latestNeighborHeight = neighborNext;
      }

      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (pendingSelf != null) setHeight(pendingSelf);
        if (neighborMeta && pendingNeighbor != null) neighborMeta.setHeight(pendingNeighbor);
      });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      let finalH = clampHeight(Number(latestHeight));
      if (selfMaxAllowedHeight != null) {
        let effectiveMax = selfMaxAllowedHeight;
        if (shouldContentCapMax && contentMaxAtStart != null) {
          effectiveMax = Math.min(effectiveMax, contentMaxAtStart);
        }
        finalH = Math.min(finalH, effectiveMax);
      }

      setStoredBoxHeight(storageKey, finalH);
      setHeight(finalH);

      if (neighborMeta && Number.isFinite(Number(latestNeighborHeight))) {
        const neighborFinal = Number(latestNeighborHeight);
        setStoredBoxHeight(neighborMeta.storageKey, neighborFinal);
        neighborMeta.setHeight(neighborFinal);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const historyBoxRef = useRef(null);
  const statsBoxRef = useRef(null);
  const membersBoxRef = useRef(null);
  const activityBoxRef = useRef(null);

  const reorderPrevRectsRef = useRef(null);
  const shouldAnimateReorderRef = useRef(false);

  const [historyBoxHeight, setHistoryBoxHeight] = useState(() => getStoredBoxHeight('sidebarBoxHeight:annotationHistory', 300));
  const [statsBoxHeight, setStatsBoxHeight] = useState(() => getStoredBoxHeight('sidebarBoxHeight:annotationStats', 260));
  const [membersBoxHeight, setMembersBoxHeight] = useState(() => getStoredBoxHeight('sidebarBoxHeight:projectMembers', 320));
  const [activityBoxHeight, setActivityBoxHeight] = useState(() => getStoredBoxHeight('sidebarBoxHeight:activity', 340));

  const defaultBoxOrder = ['history', 'stats', 'members', 'activity'];
  const [boxOrder, setBoxOrder] = useState(() => {
    try {
      const raw = localStorage.getItem('sidebarBoxOrder');
      const parsed = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(parsed) || parsed.length === 0) return defaultBoxOrder;
      const normalized = parsed.map(String);
      const merged = [...normalized.filter((id) => defaultBoxOrder.includes(id)), ...defaultBoxOrder.filter((id) => !normalized.includes(id))];
      return merged;
    } catch (_) {
      return defaultBoxOrder;
    }
  });
  const [draggingBoxId, setDraggingBoxId] = useState(null);
  const [dragOverBoxId, setDragOverBoxId] = useState(null);

  useLayoutEffect(() => {
    if (!shouldAnimateReorderRef.current) return;
    shouldAnimateReorderRef.current = false;

    const prevRects = reorderPrevRectsRef.current || {};
    const refsById = {
      history: historyBoxRef,
      stats: statsBoxRef,
      members: membersBoxRef,
      activity: activityBoxRef
    };

    const nextRects = {};
    Object.entries(refsById).forEach(([id, r]) => {
      const el = r?.current;
      if (!el) return;
      nextRects[id] = el.getBoundingClientRect();
    });

    const animatedEls = [];
    Object.entries(refsById).forEach(([id, r]) => {
      const el = r?.current;
      const a = prevRects[id];
      const b = nextRects[id];
      if (!el || !a || !b) return;

      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (!dx && !dy) return;

      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.willChange = 'transform';
      animatedEls.push(el);
    });

    if (animatedEls.length === 0) return;

    requestAnimationFrame(() => {
      animatedEls.forEach((el) => {
        el.style.transition = 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = 'translate(0px, 0px)';
      });

      const cleanup = (el) => {
        el.style.transition = '';
        el.style.transform = '';
        el.style.willChange = '';
      };

      const onEnd = (ev) => {
        if (!ev || ev.propertyName !== 'transform') return;
        const el = ev.currentTarget;
        if (!el) return;
        el.removeEventListener('transitionend', onEnd);
        cleanup(el);
      };

      animatedEls.forEach((el) => {
        el.addEventListener('transitionend', onEnd);
      });

      setTimeout(() => {
        animatedEls.forEach((el) => {
          try {
            el.removeEventListener('transitionend', onEnd);
          } catch (_) { }
          cleanup(el);
        });
      }, 750);
    });
  }, [boxOrder]);

  useEffect(() => {
    try {
      localStorage.setItem('sidebarBoxOrder', JSON.stringify(boxOrder));
    } catch (_) { }
  }, [boxOrder]);

  const getBoxOrderIndex = (id) => {
    const idx = boxOrder.indexOf(id);
    return idx === -1 ? defaultBoxOrder.indexOf(id) : idx;
  };

  const beginDragBox = (e, id, boxRef) => {
    setDraggingBoxId(id);
    setDragOverBoxId(null);

    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    } catch (_) { }

    try {
      const el = boxRef?.current;
      if (!el || !e.dataTransfer || typeof e.dataTransfer.setDragImage !== 'function') return;

      const rect = el.getBoundingClientRect();
      const ghost = el.cloneNode(true);
      ghost.style.position = 'absolute';
      ghost.style.top = '-10000px';
      ghost.style.left = '-10000px';
      ghost.style.width = `${Math.max(240, rect.width)}px`;
      ghost.style.maxWidth = 'none';
      ghost.style.pointerEvents = 'none';
      ghost.style.opacity = '0.92';
      ghost.style.boxShadow = '0 12px 30px rgba(0,0,0,0.18)';
      ghost.style.transform = 'scale(1)';
      document.body.appendChild(ghost);

      e.dataTransfer.setDragImage(ghost, 24, 24);
      setTimeout(() => {
        try { document.body.removeChild(ghost); } catch (_) { }
      }, 0);
    } catch (_) { }
  };

  const dropBoxOn = (targetId) => {
    reorderPrevRectsRef.current = {
      history: historyBoxRef.current ? historyBoxRef.current.getBoundingClientRect() : null,
      stats: statsBoxRef.current ? statsBoxRef.current.getBoundingClientRect() : null,
      members: membersBoxRef.current ? membersBoxRef.current.getBoundingClientRect() : null,
      activity: activityBoxRef.current ? activityBoxRef.current.getBoundingClientRect() : null
    };
    shouldAnimateReorderRef.current = true;

    setBoxOrder((prev) => {
      const from = draggingBoxId;
      if (!from || from === targetId) return prev;
      const next = prev.slice();
      const fromIdx = next.indexOf(from);
      const toIdx = next.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, from);
      return next;
    });
    setDraggingBoxId(null);
    setDragOverBoxId(null);
  };

  const [stats, setStats] = useState({
    annotationCount: 0,
    labelCount: 0,
    lastAnnotationText: '—'
  });
  const [chartData, setChartData] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [memberPresence, setMemberPresence] = useState({});
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isChartVisible, setIsChartVisible] = useState(true);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);
  const [isHistoryFullscreen, setIsHistoryFullscreen] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [annotationHistory, setAnnotationHistory] = useState([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [truncatedIds, setTruncatedIds] = useState(new Set());
  const [historyFullscreenListMaxHeight, setHistoryFullscreenListMaxHeight] = useState(() => getStoredBoxHeight('sidebar:historyFullscreenListMaxHeight', 340));
  const [isHistoryFullscreenListResizeHover, setIsHistoryFullscreenListResizeHover] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historySelectedLabelTypes, setHistorySelectedLabelTypes] = useState([]);
  const [historySelectedLabelOptions, setHistorySelectedLabelOptions] = useState([]);
  const [showAllHistoryLabelTypes, setShowAllHistoryLabelTypes] = useState(false);
  const [showAllHistoryLabels, setShowAllHistoryLabels] = useState(false);
  const [isHistoryFiltersVisible, setIsHistoryFiltersVisible] = useState(false);
  const [historyPeoplePopover, setHistoryPeoplePopover] = useState(null);
  const historyPeoplePopoverRef = useRef(null);
  const historyRefs = useRef(new Map());
  const historyTexts = useRef(new Map());
  const historyClickTimeoutRef = useRef(null);
  const lastHistoryClickRef = useRef({ id: null, ts: 0 });
  const historyCreatedByBackfillAttemptedRef = useRef(false);
  const [historyRowTranslateX, setHistoryRowTranslateX] = useState({});
  const [historyRowDeleting, setHistoryRowDeleting] = useState({});
  const historyRowRafRef = useRef(null);
  const historyRowPendingRef = useRef({});
  const swipeDragRef = useRef({
    id: null,
    highlightID: null,
    width: 0,
    startX: 0,
    startY: 0,
    baseX: 0,
    isDragging: false,
    lockedAxis: null,
    lastX: 0,
    prevX: 0,
    lastTs: 0,
    prevTs: 0,
    rawX: 0
  });

  const shouldCommitSwipeDelete = (currX, velocityPxPerMs, rowWidth) => {
    const width = Math.max(1, Number(rowWidth) || 0);
    const DIST_THRESHOLD = -width * 0.55;
    const FLING_VELOCITY = 0.6;
    return currX <= DIST_THRESHOLD || velocityPxPerMs <= -FLING_VELOCITY;
  };

  const commitHistoryRowDelete = (rowId, highlightId, rowWidth, fromX) => {
    if (!rowId || !highlightId) return;
    const rid = String(rowId);
    const hid = String(highlightId);
    const offscreenX = -Math.max(420, (Number(rowWidth) || 0) + 120);

    // Start the visual animation immediately (no pause)
    setHistoryRowDeleting((prev) => ({ ...(prev || {}), [rid]: true }));
    const startX = Number.isFinite(Number(fromX)) ? Number(fromX) : (historyRowTranslateX && historyRowTranslateX[rid]);
    if (Number.isFinite(Number(startX))) {
      setHistoryRowTranslateX((prev) => ({ ...(prev || {}), [rid]: Number(startX) }));
    }
    window.requestAnimationFrame(() => {
      setHistoryRowTranslateX((prev) => ({ ...(prev || {}), [rid]: offscreenX }));
    });

    // After the animation finishes, remove from UI immediately, then delete in background
    window.setTimeout(() => {
      setAnnotationHistory((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        return arr.filter((annotationEntry) => {
          if (!Array.isArray(annotationEntry)) return true;
          const hidObj = annotationEntry.find((it) => it && it.highlightID !== undefined);
          return !hidObj || String(hidObj.highlightID || '') !== hid;
        });
      });
      setHistoryRowTranslateX((prev) => {
        const next = { ...(prev || {}) };
        delete next[rid];
        return next;
      });
      setHistoryRowDeleting((prev) => {
        const next = { ...(prev || {}) };
        delete next[rid];
        return next;
      });

      // Fire and forget backend delete
      deleteHistoryHighlight(hid);
    }, 220);
  };

  const scheduleHistoryRowTranslateX = (rowId, x) => {
    if (!rowId) return;
    historyRowPendingRef.current[String(rowId)] = x;

    if (historyRowRafRef.current) return;
    historyRowRafRef.current = window.requestAnimationFrame(() => {
      const pending = historyRowPendingRef.current;
      historyRowPendingRef.current = {};
      historyRowRafRef.current = null;
      setHistoryRowTranslateX((prev) => ({ ...(prev || {}), ...(pending || {}) }));
    });
  };

  useEffect(() => {
    const onMove = (e) => {
      const s = swipeDragRef.current;
      if (!s || !s.isDragging || !s.id) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;

      if (!s.lockedAxis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        s.lockedAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (s.lockedAxis !== 'x') return;

      e.preventDefault();
      const rawX = s.baseX + dx;
      s.rawX = rawX;
      const minX = -Math.max(120, (Number(s.width) || 0) + 80);
      let nextX = rawX;
      if (nextX > 0) nextX = 0;
      if (nextX < minX) {
        const overflow = nextX - minX;
        nextX = minX + (overflow * 0.25);
      }
      const now = Date.now();
      s.prevX = Number.isFinite(s.lastX) ? s.lastX : 0;
      s.prevTs = Number.isFinite(s.lastTs) ? s.lastTs : now;
      s.lastX = nextX;
      s.lastTs = now;
      scheduleHistoryRowTranslateX(s.id, nextX);
    };

    const onUp = () => {
      const s = swipeDragRef.current;
      if (!s || !s.isDragging || !s.id) return;
      s.isDragging = false;
      const curr = Number.isFinite(s.lastX) ? s.lastX : 0;
      const dt = Math.max(1, (Number.isFinite(s.lastTs) ? s.lastTs : 0) - (Number.isFinite(s.prevTs) ? s.prevTs : 0));
      const dx = curr - (Number.isFinite(s.prevX) ? s.prevX : curr);
      const v = dx / dt;
      if (s.highlightID && shouldCommitSwipeDelete(curr, v, s.width)) {
        commitHistoryRowDelete(s.id, s.highlightID, s.width, curr);
      } else {
        scheduleHistoryRowTranslateX(s.id, 0);
      }

      s.id = null;
      s.highlightID = null;
      s.width = 0;
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };
  }, []);
  const [isStatsVisible, setIsStatsVisible] = useState(true);
  const [isMembersVisible, setIsMembersVisible] = useState(true);
  const [activityFilter, setActivityFilter] = useState('All');

  const showActivityBody = Boolean(isExpanded);

  const historyDisplayItems = useMemo(() => {
    return groupAnnotationHistoryForDisplay(annotationHistory);
  }, [annotationHistory]);

  const historyAvailableFilters = useMemo(() => {
    const typeToOptions = new Map();

    const add = (labelType, option) => {
      const lt = String(labelType || '').trim();
      const opt = String(option || '').trim();
      if (!lt || !opt) return;
      if (!typeToOptions.has(lt)) typeToOptions.set(lt, new Set());
      typeToOptions.get(lt).add(opt);
    };

    (historyDisplayItems || []).forEach((item) => {
      if (!item) return;
      const t = String(item.type || '').toLowerCase();

      if (t === 'label' && Array.isArray(item.labelGroups)) {
        item.labelGroups.forEach((lg) => {
          const lt = lg?.labelType;
          (Array.isArray(lg?.options) ? lg.options : []).forEach((opt) => add(lt, opt));
        });
        return;
      }

      if (t === 'label') {
        const lt = item.key;
        (Array.isArray(item.options) ? item.options : []).forEach((opt) => add(lt, opt));
      }
    });

    const labelTypes = Array.from(typeToOptions.keys()).sort((a, b) => a.localeCompare(b));
    const optionsByType = {};
    labelTypes.forEach((lt) => {
      optionsByType[lt] = Array.from(typeToOptions.get(lt).values()).sort((a, b) => a.localeCompare(b));
    });

    return { labelTypes, optionsByType };
  }, [historyDisplayItems]);

  const filteredHistoryItems = useMemo(() => {
    const search = String(historySearchTerm || '').trim().toLowerCase();
    const selectedTypes = new Set((historySelectedLabelTypes || []).map((s) => String(s)));
    const selectedPairs = new Set((historySelectedLabelOptions || []).map((s) => String(s)));

    const itemMatchesLabels = (item) => {
      const t = String(item?.type || '').toLowerCase();
      if (selectedTypes.size === 0 && selectedPairs.size === 0) return true;

      const pairs = [];
      if (t === 'label' && Array.isArray(item?.labelGroups)) {
        item.labelGroups.forEach((lg) => {
          const lt = String(lg?.labelType || '').trim();
          (Array.isArray(lg?.options) ? lg.options : []).forEach((opt) => {
            const o = String(opt || '').trim();
            if (lt && o) pairs.push(`${lt}::${o}`);
          });
        });
      } else if (t === 'label') {
        const lt = String(item?.key || '').trim();
        (Array.isArray(item?.options) ? item.options : []).forEach((opt) => {
          const o = String(opt || '').trim();
          if (lt && o) pairs.push(`${lt}::${o}`);
        });
      }

      if (selectedTypes.size > 0) {
        const hasType = pairs.some((p) => selectedTypes.has(p.split('::')[0]));
        if (!hasType) return false;
      }
      if (selectedPairs.size > 0) {
        const hasPair = pairs.some((p) => selectedPairs.has(p));
        if (!hasPair) return false;
      }
      return true;
    };

    const itemMatchesSearch = (item) => {
      if (!search) return true;
      const parts = [];
      parts.push(String(item?.userText || ''));
      parts.push(String(item?.type || ''));
      parts.push(String(item?.key || ''));
      (Array.isArray(item?.options) ? item.options : []).forEach((o) => parts.push(String(o || '')));
      if (Array.isArray(item?.labelGroups)) {
        item.labelGroups.forEach((lg) => {
          parts.push(String(lg?.labelType || ''));
          (Array.isArray(lg?.options) ? lg.options : []).forEach((o) => parts.push(String(o || '')));
        });
      }
      return parts.join(' ').toLowerCase().includes(search);
    };

    return (historyDisplayItems || []).filter((item) => itemMatchesSearch(item) && itemMatchesLabels(item));
  }, [historyDisplayItems, historySearchTerm, historySelectedLabelTypes, historySelectedLabelOptions]);

  const deleteHistoryHighlight = async (highlightIdToDelete) => {
    if (!highlightIdToDelete) return;
    const highlightId = String(highlightIdToDelete);
    try {
      const companyEmail = await getResolvedCompanyEmail();
      const projectName = currentProject || getCurrentProject() || 'default';
      if (!companyEmail || !projectName) return;

      // 1) Remove highlight itself
      const highlightsPath = `Companies/${companyEmail}/projects/${projectName}/highlights`;
      const highlightsData = await getFirebaseData(highlightsPath);
      const highlightsArr = Array.isArray(highlightsData) ? highlightsData : [];
      const updatedHighlights = highlightsArr.filter((h) => String(h?.id || '') !== highlightId);
      await saveFirebaseData(highlightsPath, updatedHighlights);

      // 2) Remove related annotation history entries
      const historyPath = `Companies/${companyEmail}/projects/${projectName}/annotationHistory`;
      let historyData = await getFirebaseData(historyPath);
      if (typeof historyData === 'string') {
        try {
          historyData = JSON.parse(historyData);
        } catch (_) {
          historyData = [];
        }
      }
      const historyArr = Array.isArray(historyData) ? historyData : [];
      const updatedHistory = historyArr.filter((annotationEntry) => {
        if (!Array.isArray(annotationEntry)) return true;
        const hidObj = annotationEntry.find((item) => item && item.highlightID !== undefined);
        return !hidObj || String(hidObj.highlightID || '') !== highlightId;
      });
      await saveFirebaseData(historyPath, JSON.stringify(updatedHistory));

      // Optimistic UI update
      setAnnotationHistory(updatedHistory);
      setHistoryRowTranslateX((prev) => {
        const next = { ...(prev || {}) };
        delete next[highlightId];
        return next;
      });
      try {
        document.dispatchEvent(new Event('annotationUpdated'));
      } catch (_) { }
    } catch (e) {
      console.error('Failed to delete annotation history highlight:', e);
    }
  };

  // Measure which history entries are truncated
  useEffect(() => {
    let raf = null;
    const recompute = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const newTruncated = new Set();
        historyRefs.current.forEach((el, id) => {
          if (el && el.scrollWidth > el.clientWidth) {
            newTruncated.add(id);
          }
        });
        setTruncatedIds(newTruncated);
      });
    };

    recompute();

    let ro = null;
    const boxEl = historyBoxRef?.current;
    if (boxEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        recompute();
      });
      ro.observe(boxEl);
    }
    window.addEventListener('resize', recompute);

    return () => {
      window.removeEventListener('resize', recompute);
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [annotationHistory, historyBoxHeight, isHistoryVisible, isHistoryFullscreen, boxOrder]);

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '—';

    const now = new Date();
    const time = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const diff = now - time;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getHistoryPillColors = (labelType) => {
    const builtIn = {
      sentiment: { bg: '#ecfdf5', border: '#34d399', text: '#065f46' },
      tone: { bg: '#eff6ff', border: '#60a5fa', text: '#1d4ed8' },
      intent: { bg: '#fff7ed', border: '#fb923c', text: '#9a3412' },
      emotion: { bg: '#fdf2f8', border: '#f472b6', text: '#9d174d' }
    };
    const custom = { bg: '#f5f3ff', border: '#a78bfa', text: '#5b21b6' };
    const normalized = String(labelType || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(builtIn, normalized) ? builtIn[normalized] : custom;
  };

  const memberByEmail = useMemo(() => {
    const map = new Map();
    (Array.isArray(projectMembers) ? projectMembers : []).forEach((m) => {
      if (m && m.email) map.set(String(m.email).toLowerCase(), m);
    });
    return map;
  }, [projectMembers]);

  const getUserInitials = (first, last) => {
    const firstInitial = first && String(first).trim() ? String(first).trim()[0].toUpperCase() : '';
    const lastInitial = last && String(last).trim() ? String(last).trim()[0].toUpperCase() : '';

    if (firstInitial && lastInitial) {
      return firstInitial + lastInitial;
    } else if (firstInitial) {
      return firstInitial + firstInitial;
    }
    return 'U';
  };

  const getAvatarColor = (email) => {
    if (!email) return `hsl(0, 60%, 70%)`;
    const s = String(email);
    return `hsl(${s.charCodeAt(0) * 10 % 360}, 60%, 70%)`;
  };

  const downloadTextFile = (text, filename, mime) => {
    try {
      const blob = new Blob([String(text || '')], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('Failed to download file:', e);
    }
  };

  const exportHistoryAsJson = (items) => {
    const project = String(currentProject || getCurrentProject() || 'project');
    const safeProject = project.replace(/[^a-z0-9_-]+/gi, '_');
    const resolvedItems = exportResolveHistoryItems(items);
    const payload = {
      project,
      exportedAt: new Date().toISOString(),
      items: resolvedItems
    };
    downloadTextFile(JSON.stringify(payload, null, 2), `annotation_history_${safeProject}.json`, 'application/json;charset=utf-8');
  };

  const escapeCsvCell = (v) => {
    const s = String(v == null ? '' : v);
    if (/[\n\r",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportHistoryAsCsv = (items) => {
    const list = exportResolveHistoryItems(items);
    const rows = [];
    rows.push([
      'timestamp',
      'type',
      'key',
      'labelType',
      'options',
      'userText',
      'highlightID',
      'chatID',
      'url',
      'createdByEmail',
      'createdByProfilePic',
      'modifiedByEmails'
      ,
      'modifiedByProfilePics'
    ]);

    list.forEach((item) => {
      const timestamp = item && item.timestamp ? String(item.timestamp) : '';
      const type = item && item.type ? String(item.type) : '';
      const key = item && item.key ? String(item.key) : '';
      const userText = item && item.userText ? String(item.userText) : '';
      const highlightID = item && item.highlightID != null ? String(item.highlightID) : '';
      const chatID = item && item.chatID != null ? String(item.chatID) : '';
      const url = item && item.url ? String(item.url) : '';

      const createdByEmail = item && item.createdBy && item.createdBy.email ? String(item.createdBy.email) : '';
      const createdByProfilePic = item && item.createdBy && item.createdBy.profilePic ? String(item.createdBy.profilePic) : '';
      const modifiedByEmails = (Array.isArray(item && item.modifiedBy) ? item.modifiedBy : [])
        .map((m) => (m && m.email ? String(m.email) : ''))
        .filter(Boolean)
        .join(';');
      const modifiedByProfilePics = (Array.isArray(item && item.modifiedBy) ? item.modifiedBy : [])
        .map((m) => (m && m.profilePic ? String(m.profilePic) : ''))
        .filter(Boolean)
        .join(';');

      if (String(type || '').toLowerCase() === 'label' && Array.isArray(item && item.labelGroups)) {
        item.labelGroups.forEach((lg) => {
          const labelType = lg && lg.labelType ? String(lg.labelType) : '';
          const opts = (Array.isArray(lg && lg.options) ? lg.options : []).map((o) => String(o)).filter(Boolean);
          rows.push([
            timestamp,
            type,
            key,
            labelType,
            opts.join(';'),
            userText,
            highlightID,
            chatID,
            url,
            createdByEmail,
            createdByProfilePic,
            modifiedByEmails
            ,
            modifiedByProfilePics
          ]);
        });
        return;
      }

      const options = (Array.isArray(item && item.options) ? item.options : []).map((o) => String(o)).filter(Boolean);
      rows.push([
        timestamp,
        type,
        key,
        '',
        options.join(';'),
        userText,
        highlightID,
        chatID,
        url,
        createdByEmail,
        createdByProfilePic,
        modifiedByEmails,
        modifiedByProfilePics
      ]);
    });

    const csv = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\n');
    const project = String(currentProject || getCurrentProject() || 'project');
    const safeProject = project.replace(/[^a-z0-9_-]+/gi, '_');
    downloadTextFile(csv, `annotation_history_${safeProject}.csv`, 'text/csv;charset=utf-8');
  };

  function mergePeopleLists(a, b) {
    const out = [];
    const seen = new Set();
    const push = (p) => {
      const email = p && p.email ? String(p.email).toLowerCase() : '';
      if (!email || seen.has(email)) return;
      seen.add(email);
      out.push(p);
    };
    (Array.isArray(a) ? a : []).forEach(push);
    (Array.isArray(b) ? b : []).forEach(push);
    out.sort((x, y) => String((y && y.ts) || '').localeCompare(String((x && x.ts) || '')));
    return out.slice(0, 8);
  }

  function groupAnnotationHistoryForDisplay(history) {
    const list = Array.isArray(history) ? history : [];
    const groups = new Map();
    const singles = [];

    const getVal = (entryArr, k) => {
      if (!Array.isArray(entryArr)) return null;
      const obj = entryArr.find((o) => o && Object.prototype.hasOwnProperty.call(o, k));
      return obj ? obj[k] : null;
    };

    for (let idx = 0; idx < list.length; idx++) {
      const entry = list[idx];
      if (!Array.isArray(entry)) continue;

      const id = String(getVal(entry, 'id') || idx);
      const userText = getVal(entry, 'userText') || '—';
      const key = getVal(entry, 'key') || '';
      const type = getVal(entry, 'type') || '';
      const options = getVal(entry, 'options') || [];
      const timestamp = getVal(entry, 'timestamp');
      const highlightID = getVal(entry, 'highlightID');
      const chatID = getVal(entry, 'chatID');
      const url = getVal(entry, 'url');
      const createdBy = getVal(entry, 'createdBy');
      const modifiedBy = getVal(entry, 'modifiedBy');

      const isLabel = String(type || '').toLowerCase() === 'label';
      const groupKey = isLabel
        ? `${String(highlightID || '')}||${String(url || '')}||${String(chatID || '')}||label`
        : null;

      if (!isLabel || !groupKey) {
        singles.push({
          displayId: id,
          userText,
          key,
          type,
          options,
          timestamp,
          highlightID,
          chatID,
          url,
          createdBy,
          modifiedBy
        });
        continue;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          displayId: `labelgroup-${groupKey}`,
          userText,
          type: 'label',
          timestamp,
          highlightID,
          chatID,
          url,
          createdBy,
          modifiedBy,
          labelGroups: new Map()
        });
      }

      const g = groups.get(groupKey);
      if (timestamp && (!g.timestamp || String(timestamp) > String(g.timestamp))) {
        g.timestamp = timestamp;
      }

      g.modifiedBy = mergePeopleLists(g.modifiedBy, modifiedBy);

      const labelType = String(key || '').trim();
      if (!g.labelGroups.has(labelType)) {
        g.labelGroups.set(labelType, new Set());
      }
      const set = g.labelGroups.get(labelType);
      (Array.isArray(options) ? options : []).filter(Boolean).forEach((opt) => set.add(String(opt)));
    }

    const mergedLabels = Array.from(groups.values()).map((g) => {
      const labelGroupsArr = Array.from(g.labelGroups.entries()).map(([labelType, set]) => ({
        labelType,
        options: Array.from(set.values())
      }));
      labelGroupsArr.sort((a, b) => a.labelType.localeCompare(b.labelType));
      return { ...g, labelGroups: labelGroupsArr };
    });

    const combined = [...mergedLabels, ...singles];
    combined.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    return combined;
  }

  // Calculate statistics from annotation history and generate chart data
  const calculateStats = (annotationHistory) => {
    if (!annotationHistory || !Array.isArray(annotationHistory)) {
      return {
        annotationCount: 0,
        labelCount: 0,
        lastAnnotationText: '—',
        chartData: []
      };
    }

    let annotationCount = 0;
    const uniqueLabels = new Set(); // Track unique labels (key:option combinations)
    let lastAnnotationTime = null;

    // Initialize chart data for the last 7 days
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayCounts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };

    // Get today's day of week (0 = Sunday, 1 = Monday, etc.)
    const today = new Date();
    const todayDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Map to our day order (Monday = 0, Sunday = 6)
    const dayIndexMap = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };
    const todayIndex = dayIndexMap[todayDayOfWeek];

    annotationHistory.forEach(annotationGroup => {
      if (!Array.isArray(annotationGroup)) return;

      const typeObj = annotationGroup.find(item => item && item.type);
      const optionsObj = annotationGroup.find(item => item && item.options);
      const timestampObj = annotationGroup.find(item => item && item.timestamp);
      const keyObj = annotationGroup.find(item => item && item.key);

      if (typeObj && optionsObj) {
        const annotationType = typeObj.type.toLowerCase();
        const options = Array.isArray(optionsObj.options) ? optionsObj.options : [optionsObj.options];
        const timestamp = timestampObj ? new Date(timestampObj.timestamp) : new Date();
        const key = keyObj ? keyObj.key : '';

        // Count all annotations (labels + codes)
        annotationCount += options.length;

        // Count unique labels only (for "Total Labels" - unique label:option combinations)
        if (annotationType === 'label' && key) {
          options.forEach(option => {
            uniqueLabels.add(`${key}:${option}`);
          });
        }

        // Track last annotation time
        if (!lastAnnotationTime || timestamp > lastAnnotationTime) {
          lastAnnotationTime = timestamp;
        }

        // Group annotations by day of week for chart
        const annotationDate = timestamp;
        const annotationDayOfWeek = annotationDate.getDay();
        const annotationDayIndex = dayIndexMap[annotationDayOfWeek];

        // Calculate how many days ago this annotation was made
        const daysDiff = Math.floor((today - annotationDate) / (1000 * 60 * 60 * 24));

        // Only include annotations from the last 7 days
        if (daysDiff >= 0 && daysDiff < 7) {
          // Calculate which day in our week this belongs to
          const chartDayIndex = (todayIndex - daysDiff + 7) % 7;
          const chartDay = days[chartDayIndex];
          dayCounts[chartDay] += options.length;
        }
      }
    });

    // Create chart data array in order (Mon through Sun)
    const chartDataArray = days.map(day => ({
      day,
      value: dayCounts[day]
    }));

    return {
      annotationCount,
      labelCount: uniqueLabels.size, // Count of unique labels used
      lastAnnotationText: formatRelativeTime(lastAnnotationTime),
      chartData: chartDataArray
    };
  };

  useEffect(() => {
    if (!currentProject) {
      setStats({
        annotationCount: 0,
        labelCount: 0,
        lastAnnotationText: '—'
      });
      setChartData([]);
      setIsLoadingStats(false);
      return;
    }

    setIsLoadingStats(true);
    let minLoadTime = setTimeout(() => {
      setIsLoadingStats(false);
    }, 300); // Minimum 300ms display time

    let listenerRef = null;
    let unsubscribe = null;

    const setupListener = async () => {
      try {
        // Use getResolvedCompanyEmail to support shared projects
        const companyEmail = await getResolvedCompanyEmail();
        const projectName = currentProject || getCurrentProject() || 'default';

        if (!companyEmail) {
          // Fallback to localStorage for guest users
          const stored = localStorage.getItem('annotationHistory');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const calculatedStats = calculateStats(parsed);
              setStats(calculatedStats);
            } catch (e) {
              console.error('Error parsing localStorage annotation history:', e);
            }
          }
          return;
        }

        // Company email is already formatted (periods -> commas) by getResolvedCompanyEmail
        const annotationHistoryPath = `Companies/${companyEmail}/projects/${projectName}/annotationHistory`;

        listenerRef = ref(database, annotationHistoryPath);

        const handleValueChange = (snapshot) => {
          const data = snapshot.val();
          let annotationHistory = [];

          if (data) {
            // Handle string or array format
            if (typeof data === 'string') {
              try {
                annotationHistory = JSON.parse(data);
              } catch (e) {
                console.error('Error parsing annotation history string:', e);
                annotationHistory = [];
              }
            } else if (Array.isArray(data)) {
              annotationHistory = data;
            } else {
              // If it's an object, try to convert to array
              annotationHistory = Object.values(data);
            }
          }

          const calculatedStats = calculateStats(annotationHistory);
          setStats({
            annotationCount: calculatedStats.annotationCount,
            labelCount: calculatedStats.labelCount,
            lastAnnotationText: calculatedStats.lastAnnotationText
          });
          setChartData(calculatedStats.chartData);

          // Wait for minimum load time before hiding skeleton
          setTimeout(() => {
            setIsLoadingStats(false);
          }, 300);
        };

        unsubscribe = onValue(listenerRef, handleValueChange);
      } catch (error) {
        console.error('Error setting up annotation statistics listener:', error);
        setStats({
          annotationCount: 0,
          labelCount: 0,
          lastAnnotationText: '—'
        });
        setChartData([]);
        setTimeout(() => {
          setIsLoadingStats(false);
        }, 300);
      }
    };

    setupListener();

    // Also listen to annotationUpdated events (dispatched when annotations are added via popup)
    const handleAnnotationUpdate = async () => {
      try {
        // Use getResolvedCompanyEmail to support shared projects
        const companyEmail = await getResolvedCompanyEmail();
        const projectName = currentProject || getCurrentProject() || 'default';

        if (!companyEmail) {
          // Fallback to localStorage
          const stored = localStorage.getItem('annotationHistory');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const calculatedStats = calculateStats(parsed);
              setStats({
                annotationCount: calculatedStats.annotationCount,
                labelCount: calculatedStats.labelCount,
                lastAnnotationText: calculatedStats.lastAnnotationText
              });
              setChartData(calculatedStats.chartData);
            } catch (e) {
              console.error('Error parsing localStorage annotation history:', e);
            }
          }
          return;
        }

        // Company email is already formatted (periods -> commas) by getResolvedCompanyEmail
        const annotationHistoryPath = `Companies/${companyEmail}/projects/${projectName}/annotationHistory`;
        const data = await getFirebaseData(annotationHistoryPath);

        let annotationHistory = [];
        if (data) {
          if (typeof data === 'string') {
            try {
              annotationHistory = JSON.parse(data);
            } catch (e) {
              annotationHistory = [];
            }
          } else if (Array.isArray(data)) {
            annotationHistory = data;
          } else {
            annotationHistory = Object.values(data);
          }
        }

        const calculatedStats = calculateStats(annotationHistory);
        setStats({
          annotationCount: calculatedStats.annotationCount,
          labelCount: calculatedStats.labelCount,
          lastAnnotationText: calculatedStats.lastAnnotationText
        });
        setChartData(calculatedStats.chartData);
      } catch (error) {
        console.error('Error updating stats from annotation event:', error);
      }
    };

    // Listen to annotation update events
    document.addEventListener('annotationUpdated', handleAnnotationUpdate);
    document.addEventListener('annotationAdded', handleAnnotationUpdate);

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      document.removeEventListener('annotationUpdated', handleAnnotationUpdate);
      document.removeEventListener('annotationAdded', handleAnnotationUpdate);
      clearTimeout(minLoadTime);
    };
  }, [currentProject]);

  useEffect(() => {
    let cancelled = false;
    let listenerRef = null;
    let listenerFn = null;

    const sortHistory = (list) => {
      const safe = Array.isArray(list) ? list : [];
      return safe.slice().sort((a, b) => {
        const getTs = (entry) => {
          if (!Array.isArray(entry)) return 0;
          const tsObj = entry.find((obj) => obj && Object.prototype.hasOwnProperty.call(obj, 'timestamp'));
          const ts = tsObj && tsObj.timestamp ? Date.parse(tsObj.timestamp) : 0;
          return Number.isFinite(ts) ? ts : 0;
        };
        return getTs(b) - getTs(a);
      });
    };

    const attach = async () => {
      setIsLoadingHistory(true);
      try {
        const resolvedCompanyEmail = await getResolvedCompanyEmail();
        const projectName = currentProject || getCurrentProject();

        if (cancelled) return;

        if (!resolvedCompanyEmail || !projectName) {
          setAnnotationHistory([]);
          setIsLoadingHistory(false);
          return;
        }

        const path = `Companies/${resolvedCompanyEmail}/projects/${projectName}/annotationHistory`;
        listenerRef = ref(database, path);
        listenerFn = (snapshot) => {
          if (cancelled) return;
          let data = snapshot.val();
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (_) {
              data = [];
            }
          }
          const sorted = sortHistory(data);
          setAnnotationHistory(sorted);
          setIsLoadingHistory(false);
        };

        onValue(listenerRef, listenerFn, () => {
          if (cancelled) return;
          setAnnotationHistory([]);
          setIsLoadingHistory(false);
        });
      } catch (_) {
        if (!cancelled) {
          setAnnotationHistory([]);
          setIsLoadingHistory(false);
        }
      }
    };

    attach();
    return () => {
      cancelled = true;
      if (listenerRef && listenerFn) {
        off(listenerRef, 'value', listenerFn);
      } else if (listenerRef) {
        off(listenerRef);
      }
    };
  }, [currentProject]);

  useEffect(() => {
    if (historyCreatedByBackfillAttemptedRef.current) return;
    if (!currentProject) return;
    if (isLoadingHistory) return;
    if (!Array.isArray(annotationHistory) || annotationHistory.length === 0) return;

    const needsBackfill = annotationHistory.some((entry) => {
      if (!Array.isArray(entry)) return false;
      const hasCreatedBy = entry.some((obj) => obj && Object.prototype.hasOwnProperty.call(obj, 'createdBy'));
      return !hasCreatedBy;
    });
    if (!needsBackfill) return;

    historyCreatedByBackfillAttemptedRef.current = true;

    (async () => {
      try {
        const companyEmail = await getResolvedCompanyEmail();
        const projectName = currentProject || getCurrentProject() || 'default';
        if (!companyEmail || !projectName) return;

        const highlightsPath = `Companies/${companyEmail}/projects/${projectName}/highlights`;
        const historyPath = `Companies/${companyEmail}/projects/${projectName}/annotationHistory`;

        const highlightsData = await getFirebaseData(highlightsPath);
        const highlightsArr = Array.isArray(highlightsData) ? highlightsData : [];
        const highlightIdToEmail = new Map();
        highlightsArr.forEach((h) => {
          const id = h && h.id !== undefined ? String(h.id) : '';
          let email = h && h.userEmail ? String(h.userEmail) : '';
          if (email && email.includes(',')) email = email.replace(/,/g, '.');
          if (id && email) highlightIdToEmail.set(id, email);
        });

        let didChange = false;
        const updated = (annotationHistory || []).map((entry) => {
          if (!Array.isArray(entry)) return entry;
          const hasCreatedBy = entry.some((obj) => obj && Object.prototype.hasOwnProperty.call(obj, 'createdBy'));
          if (hasCreatedBy) return entry;

          const hidObj = entry.find((obj) => obj && Object.prototype.hasOwnProperty.call(obj, 'highlightID'));
          const highlightID = hidObj && hidObj.highlightID !== undefined ? String(hidObj.highlightID) : '';
          const email = highlightIdToEmail.get(highlightID);
          if (!email) return entry;

          const member = memberByEmail.get(String(email).toLowerCase());
          const firstName = member && member.firstName ? String(member.firstName) : '';
          const lastName = member && member.lastName ? String(member.lastName) : '';
          const name = `${firstName} ${lastName}`.trim() || (member && member.name) || String(email).split('@')[0];

          didChange = true;
          return [...entry, { createdBy: { email, firstName, lastName, name } }];
        });

        if (!didChange) return;

        // Optimistic UI update
        setAnnotationHistory(updated);

        // Best-effort persistence
        try {
          await saveFirebaseData(historyPath, JSON.stringify(updated));
        } catch (e) {
          console.warn('Unable to persist createdBy backfill (permission or network):', e);
        }
      } catch (e) {
        console.warn('Failed to backfill createdBy on annotation history:', e);
      }
    })();
  }, [annotationHistory, currentProject, isLoadingHistory, memberByEmail]);

  useEffect(() => {
    if (!historyPeoplePopover) return;

    const onDown = (e) => {
      const el = historyPeoplePopoverRef.current;
      if (el && !el.contains(e.target)) {
        setHistoryPeoplePopover(null);
      }
    };

    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [historyPeoplePopover]);

  // Fetch project members with real-time updates
  useEffect(() => {
    if (!currentProject) {
      setProjectMembers([]);
      setIsLoadingMembers(false);
      return;
    }

    setIsLoadingMembers(true);
    const minLoadTime = setTimeout(() => {
      setIsLoadingMembers(false);
    }, 300); // Minimum 300ms display time

    let membersUnsubscribe = null;
    const presenceCleanups = [];
    const profilePicListeners = [];

    const fetchMembers = async () => {
      try {
        const companyEmail = await getResolvedCompanyEmail();
        const projectName = currentProject || getCurrentProject() || 'default';

        if (!companyEmail) {
          setProjectMembers([]);
          return;
        }

        const membersPath = `Companies/${companyEmail}/projects/${projectName}/members`;
        const membersRef = ref(database, membersPath);

        const handleMembersChange = async (snapshot) => {
          const membersData = snapshot.val();

          // Clean up old listeners
          profilePicListeners.forEach(({ ref: refToClean, listener }) => {
            off(refToClean, 'value', listener);
          });
          profilePicListeners.length = 0;
          presenceCleanups.forEach(cleanup => cleanup());
          presenceCleanups.length = 0;

          if (!membersData) {
            setProjectMembers([]);
            return;
          }

          // Convert members object to array and fetch profile pictures and names
          const memberEmails = Object.keys(membersData).map(emailPath => emailPath.replace(/,/g, '.'));

          const membersWithData = await Promise.all(
            memberEmails.map(async (email) => {
              const emailFormatted = email.replace(/\./g, ',');
              const memberInfo = membersData[emailFormatted] || {};

              let profilePic = null;
              let userName = null;
              let firstName = null;
              let lastName = null;
              let userCompanyEmail = null;

              try {
                userCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${emailFormatted}`);

                if (userCompanyEmail) {
                  const [picData, userData] = await Promise.all([
                    getFirebaseData(`Companies/${userCompanyEmail}/users/${emailFormatted}/profileImage`).catch(() => null),
                    getFirebaseData(`Companies/${userCompanyEmail}/users/${emailFormatted}`).catch(() => null)
                  ]);

                  profilePic = picData || null;
                  if (userData) {
                    firstName = userData.firstName || null;
                    lastName = userData.lastName || null;
                    userName = userData.name || (firstName && lastName ? `${firstName} ${lastName}` : firstName || email.split('@')[0]);
                  }
                }

                // Fallback to project owner's company
                if (!profilePic || !userName) {
                  const [picData, userData] = await Promise.all([
                    getFirebaseData(`Companies/${companyEmail}/users/${emailFormatted}/profileImage`).catch(() => null),
                    getFirebaseData(`Companies/${companyEmail}/users/${emailFormatted}`).catch(() => null)
                  ]);

                  if (!profilePic) profilePic = picData || null;
                  if (!userName) {
                    userName = userData?.name || (userData?.firstName && userData?.lastName
                      ? `${userData.firstName} ${userData.lastName}`
                      : userData?.firstName || email.split('@')[0]);
                  }
                  if (!firstName) firstName = userData?.firstName || null;
                  if (!lastName) lastName = userData?.lastName || null;
                }
              } catch (e) {
                console.warn('Could not fetch user data for:', email, e);
                userName = email.split('@')[0];
              }

              return {
                email,
                name: userName || email.split('@')[0],
                firstName: firstName || null,
                lastName: lastName || null,
                role: memberInfo.role || 'member',
                profilePic: profilePic || null,
                userCompanyEmail: userCompanyEmail || companyEmail
              };
            })
          );

          setProjectMembers(membersWithData);

          // Wait for minimum load time before hiding skeleton
          setTimeout(() => {
            setIsLoadingMembers(false);
          }, 300);

          // Set up real-time listeners for profile pictures and user data
          membersWithData.forEach((member) => {
            const emailFormatted = member.email.replace(/\./g, ',');

            // Profile picture listener
            const profilePicPath = `Companies/${member.userCompanyEmail}/users/${emailFormatted}/profileImage`;
            const profilePicRef = ref(database, profilePicPath);

            const profilePicListener = onValue(profilePicRef, (snapshot) => {
              const newProfilePic = snapshot.val();
              setProjectMembers(prev => prev.map(m =>
                m.email === member.email
                  ? { ...m, profilePic: newProfilePic || null }
                  : m
              ));
            });

            profilePicListeners.push({ ref: profilePicRef, listener: profilePicListener });

            // User data listener (for firstName, lastName, name updates)
            const userDataPath = `Companies/${member.userCompanyEmail}/users/${emailFormatted}`;
            const userDataRef = ref(database, userDataPath);

            const userDataListener = onValue(userDataRef, (snapshot) => {
              const userData = snapshot.val();
              if (userData) {
                const firstName = userData.firstName || null;
                const lastName = userData.lastName || null;
                const name = userData.name || (firstName && lastName ? `${firstName} ${lastName}` : firstName || member.email.split('@')[0]);

                setProjectMembers(prev => prev.map(m =>
                  m.email === member.email
                    ? { ...m, firstName, lastName, name }
                    : m
                ));
              }
            });

            profilePicListeners.push({ ref: userDataRef, listener: userDataListener });

            // Presence listener
            const cleanup = listenToUserPresence(member.email, (presence) => {
              setMemberPresence(prev => ({
                ...prev,
                [member.email]: presence
              }));
            });
            if (cleanup) {
              presenceCleanups.push(cleanup);
            }
          });
        };

        membersUnsubscribe = onValue(membersRef, handleMembersChange);
      } catch (error) {
        console.error('Error fetching project members:', error);
        setProjectMembers([]);
        setTimeout(() => {
          setIsLoadingMembers(false);
        }, 300);
      }
    };

    fetchMembers();

    return () => {
      if (membersUnsubscribe) {
        membersUnsubscribe();
      }
      profilePicListeners.forEach(({ ref: refToClean, listener }) => {
        off(refToClean, 'value', listener);
      });
      presenceCleanups.forEach(cleanup => cleanup());
      clearTimeout(minLoadTime);
    };
  }, [currentProject]);

  return (
    <div style={{
      padding: '12px',
      paddingBottom: '40px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      alignItems: 'stretch',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0
    }}>
      {!isExpanded && (
        <div ref={historyBoxRef} style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          padding: '12px',
          paddingBottom: '4px',
          marginBottom: isHistoryFullscreen ? '0px' : '16px',
          flex: isHistoryFullscreen ? 1 : 'unset',
          minHeight: isHistoryFullscreen ? 0 : 'unset',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          height: isHistoryFullscreen ? 'auto' : `${isHistoryVisible ? historyBoxHeight : 56}px`,
          maxHeight: '100%',
          order: getBoxOrderIndex('history'),
          opacity: draggingBoxId === 'history' ? 0.65 : 1,
          outline: dragOverBoxId === 'history' && draggingBoxId && draggingBoxId !== 'history' ? '2px dashed #60a5fa' : 'none',
          outlineOffset: '2px'
        }}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggingBoxId && draggingBoxId !== 'history') setDragOverBoxId('history');
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (draggingBoxId && draggingBoxId !== 'history') setDragOverBoxId('history');
          }}
          onDragLeave={() => {
            if (dragOverBoxId === 'history') setDragOverBoxId(null);
          }}
          onDrop={() => dropBoxOn('history')}
        >
          {(!isHistoryFullscreen && isHistoryVisible) && (
            <div
              onMouseDown={(e) => beginResizeHeight(e, { boxId: 'history', storageKey: 'sidebarBoxHeight:annotationHistory', setHeight: setHistoryBoxHeight, boxRef: historyBoxRef, edge: 'top' })}
              style={{
                position: 'absolute',
                left: '8px',
                right: '8px',
                top: '0px',
                height: '6px',
                cursor: 'row-resize',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                zIndex: 6
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              role="separator"
              aria-orientation="horizontal"
              tabIndex={-1}
            />
          )}
          {(!isHistoryFullscreen) && (
            <div
              onPointerDown={(e) => {
                if (!isHistoryVisible) setIsHistoryVisible(true);
                beginResizeHeight(e, {
                  boxId: 'history',
                  storageKey: 'sidebarBoxHeight:annotationHistory',
                  setHeight: setHistoryBoxHeight,
                  boxRef: historyBoxRef,
                  edge: 'bottom',
                  startHeightOverride: !isHistoryVisible ? historyBoxHeight : undefined
                });
              }}
              style={{
                position: 'absolute',
                left: '8px',
                right: '8px',
                bottom: '0px',
                height: '6px',
                cursor: 'row-resize',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                zIndex: 50,
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              role="separator"
              aria-orientation="horizontal"
              tabIndex={-1}
            />
          )}
          <div className="stats-header" style={{
            padding: '0 0 8px 0',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                draggable
                onDragStart={(e) => beginDragBox(e, 'history', historyBoxRef)}
                onDragEnd={() => setDraggingBoxId(null)}
                title="Drag to reorder"
                style={{
                  width: '10px',
                  height: '18px',
                  marginRight: '8px',
                  cursor: 'grab',
                  opacity: 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none'
                }}
              >
                <div style={{ width: '2px', height: '14px', backgroundColor: '#d1d5db', borderRadius: '2px', boxShadow: '4px 0 0 #d1d5db' }} />
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: '6px', color: 'var(--color-dark-gray, #374151)' }}
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{
                marginRight: '26px',
                color: 'var(--color-dark-gray, #374151)',
                fontSize: '14px',
                fontWeight: 500
              }}>
                Annotation History
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => {
                  setIsHistoryFullscreen((prev) => {
                    const next = !prev;
                    if (next) {
                      setIsHistoryVisible(true);
                    }
                    return next;
                  });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: '#6b7280',
                  transition: 'all 0.2s',
                  padding: '0'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
                title={isHistoryFullscreen ? 'Exit fullscreen' : 'Expand'}
                type="button"
              >
                {isHistoryFullscreen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </button>

              {!isHistoryFullscreen && (
                <button
                  onClick={() => setIsHistoryVisible(!isHistoryVisible)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    color: '#6b7280',
                    transition: 'all 0.2s',
                    padding: '0'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = '#374151';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#6b7280';
                  }}
                  title={isHistoryVisible ? 'Hide history' : 'Show history'}
                  type="button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isHistoryVisible ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {isHistoryVisible && (
            <div style={{
              padding: '0 0 8px 0',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {isLoadingHistory ? (
                <div style={{
                  padding: '10px 12px',
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  Loading...
                </div>
              ) : annotationHistory.length === 0 ? (
                <div style={{
                  padding: '10px 12px',
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  No annotations yet
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  flex: 1,
                  minHeight: 0
                }}>
                  {isHistoryFullscreen && (
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="text"
                          value={historySearchTerm}
                          onChange={(e) => setHistorySearchTerm(e.target.value)}
                          placeholder="Search history..."
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            fontSize: '14px',
                            outline: 'none',
                            backgroundColor: '#ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => setIsHistoryFiltersVisible((v) => !v)}
                          title={isHistoryFiltersVisible ? 'Hide filters' : 'Show filters'}
                          style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '38px',
                            height: '38px',
                            borderRadius: '12px',
                            border: '1px solid #e5e7eb',
                            background: isHistoryFiltersVisible ? '#f3f4f6' : '#ffffff',
                            color: '#374151',
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 3H2l8 9v7l4 2v-9l8-9z" />
                          </svg>
                          {(historySelectedLabelTypes.length > 0 || historySelectedLabelOptions.length > 0) && (
                            <span style={{
                              position: 'absolute',
                              top: '-6px',
                              right: '-6px',
                              width: '18px',
                              height: '18px',
                              borderRadius: '999px',
                              background: '#000000',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '2px solid #ffffff'
                            }}>
                              {Math.min(9, historySelectedLabelTypes.length + historySelectedLabelOptions.length)}
                            </span>
                          )}
                        </button>
                      </div>

                      {isHistoryFiltersVisible && (
                        <div style={{
                          marginTop: '8px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          background: '#f9fafb',
                          padding: '10px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#374151' }}>Label types</div>
                            <button
                              type="button"
                              onClick={() => {
                                setHistorySearchTerm('');
                                setHistorySelectedLabelTypes([]);
                                setHistorySelectedLabelOptions([]);
                              }}
                              style={{
                                border: '1px solid #e5e7eb',
                                background: '#ffffff',
                                borderRadius: '10px',
                                padding: '6px 10px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#374151',
                                flexShrink: 0
                              }}
                            >
                              Clear
                            </button>
                          </div>

                          {(() => {
                            const allTypes = historyAvailableFilters.labelTypes || [];
                            const selectedTypes = (historySelectedLabelTypes || []).filter((t) => allTypes.includes(t));
                            const mergedTypes = Array.from(new Set([...selectedTypes, ...allTypes]));
                            const visibleTypes = showAllHistoryLabelTypes ? mergedTypes : mergedTypes.slice(0, 12);
                            const hiddenTypesCount = Math.max(0, mergedTypes.length - visibleTypes.length);
                            return (
                              <div style={{
                                marginTop: '8px',
                                display: 'flex',
                                gap: '6px',
                                overflowX: 'auto',
                                paddingBottom: '4px'
                              }}>
                                {visibleTypes.map((lt) => {
                                  const checked = historySelectedLabelTypes.includes(lt);
                                  const hasSelectedLabelsForType = (historySelectedLabelOptions || []).some((p) => String(p).split('::')[0] === lt);
                                  return (
                                    <button
                                      key={lt}
                                      type="button"
                                      onClick={() => {
                                        const next = new Set(historySelectedLabelTypes);
                                        if (checked) next.delete(lt);
                                        else next.add(lt);
                                        const nextArr = Array.from(next.values());
                                        setHistorySelectedLabelTypes(nextArr);
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!checked) e.currentTarget.style.background = '#f9fafb';
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!checked) e.currentTarget.style.background = '#ffffff';
                                      }}
                                      style={{
                                        whiteSpace: 'nowrap',
                                        padding: '5px 9px',
                                        borderRadius: '999px',
                                        border: checked
                                          ? '1px solid #9ca3af'
                                          : (hasSelectedLabelsForType ? '1px solid #10a37f' : '1px solid #e5e7eb'),
                                        background: checked ? '#f3f4f6' : '#ffffff',
                                        color: '#111827',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        boxShadow: checked ? 'inset 0 0 0 1px rgba(17,24,39,0.08)' : 'none',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        {lt}
                                        {hasSelectedLabelsForType && (
                                          <span
                                            style={{
                                              width: '7px',
                                              height: '7px',
                                              borderRadius: '999px',
                                              background: '#10a37f',
                                              boxShadow: '0 0 0 2px rgba(16, 163, 127, 0.18)'
                                            }}
                                          />
                                        )}
                                      </span>
                                    </button>
                                  );
                                })}
                                {hiddenTypesCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setShowAllHistoryLabelTypes((v) => !v)}
                                    style={{
                                      whiteSpace: 'nowrap',
                                      padding: '5px 9px',
                                      borderRadius: '999px',
                                      border: '1px solid #e5e7eb',
                                      background: '#ffffff',
                                      color: '#374151',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {showAllHistoryLabelTypes ? 'Less' : `More (${hiddenTypesCount})`}
                                  </button>
                                )}
                              </div>
                            );
                          })()}

                          <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 800, color: '#374151' }}>Labels</div>

                          {(() => {
                            const allTypes = historyAvailableFilters.labelTypes || [];
                            const selectedTypesSet = historySelectedLabelTypes.length > 0 ? new Set(historySelectedLabelTypes) : null;
                            const impliedTypesFromSelectedLabels = new Set(
                              (historySelectedLabelOptions || []).map((s) => String(s).split('::')[0]).filter(Boolean)
                            );
                            const typesSet = new Set(
                              selectedTypesSet ? Array.from(selectedTypesSet.values()) : allTypes
                            );
                            impliedTypesFromSelectedLabels.forEach((t) => typesSet.add(t));
                            const typesToShow = Array.from(typesSet.values());
                            const allPairs = [];
                            typesToShow.forEach((lt) => {
                              const opts = (historyAvailableFilters.optionsByType || {})[lt] || [];
                              opts.forEach((opt) => {
                                allPairs.push({ lt, opt, id: `${lt}::${opt}` });
                              });
                            });
                            const selectedPairs = new Set((historySelectedLabelOptions || []).map((s) => String(s)));
                            const pinned = allPairs.filter((p) => selectedPairs.has(p.id));
                            const mergedPairs = pinned.concat(allPairs.filter((p) => !selectedPairs.has(p.id)));
                            const visiblePairs = showAllHistoryLabels ? mergedPairs : mergedPairs.slice(0, 16);
                            const hiddenPairsCount = Math.max(0, mergedPairs.length - visiblePairs.length);

                            if (allPairs.length === 0) {
                              return <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>No labels available</div>;
                            }

                            return (
                              <div style={{
                                marginTop: '10px',
                                display: 'flex',
                                gap: '8px',
                                overflowX: 'auto',
                                paddingBottom: '6px'
                              }}>
                                {visiblePairs.map(({ id, opt }) => {
                                  const checked = historySelectedLabelOptions.includes(id);
                                  return (
                                    <button
                                      key={id}
                                      type="button"
                                      onClick={() => {
                                        const next = new Set(historySelectedLabelOptions);
                                        if (checked) next.delete(id);
                                        else next.add(id);
                                        setHistorySelectedLabelOptions(Array.from(next.values()));
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!checked) e.currentTarget.style.background = '#f9fafb';
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!checked) e.currentTarget.style.background = '#ffffff';
                                      }}
                                      style={{
                                        whiteSpace: 'nowrap',
                                        padding: '6px 10px',
                                        borderRadius: '999px',
                                        border: checked ? '1px solid #9ca3af' : '1px solid #e5e7eb',
                                        background: checked ? '#f3f4f6' : '#ffffff',
                                        color: '#111827',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        boxShadow: checked ? 'inset 0 0 0 1px rgba(17,24,39,0.08)' : 'none',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                                {hiddenPairsCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setShowAllHistoryLabels((v) => !v)}
                                    style={{
                                      whiteSpace: 'nowrap',
                                      padding: '6px 10px',
                                      borderRadius: '999px',
                                      border: '1px solid #e5e7eb',
                                      background: '#ffffff',
                                      color: '#374151',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {showAllHistoryLabels ? 'Less' : `More (${hiddenPairsCount})`}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0px',
                    maxHeight: isHistoryFullscreen ? `${historyFullscreenListMaxHeight}px` : '320px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                    flex: 1,
                    minHeight: 0
                  }}>
                    {(isHistoryFullscreen ? filteredHistoryItems : historyDisplayItems)
                      .slice(0, isHistoryFullscreen ? undefined : 8)
                      .map((item) => {
                        const id = String(item.displayId);
                        const userText = item.userText || '—';
                        const type = item.type || '';
                        const key = item.key || '';
                        const options = item.options || [];
                        const timestamp = item.timestamp;
                        const highlightID = item.highlightID;
                        const chatID = item.chatID;
                        const createdBy = item.createdBy;
                        const modifiedBy = item.modifiedBy;

                        const createdByEmail = createdBy && createdBy.email ? String(createdBy.email) : '';
                        const createdByFirstName = createdBy && createdBy.firstName ? String(createdBy.firstName) : '';
                        const createdByLastName = createdBy && createdBy.lastName ? String(createdBy.lastName) : '';

                        const modifiers = Array.isArray(modifiedBy) ? modifiedBy : [];
                        const participants = [];
                        if (createdByEmail) participants.push({ email: createdByEmail, firstName: createdByFirstName, lastName: createdByLastName, ts: createdBy && createdBy.ts });
                        modifiers.forEach((m) => {
                          if (!m || !m.email) return;
                          const em = String(m.email);
                          if (createdByEmail && em.toLowerCase() === createdByEmail.toLowerCase()) return;
                          participants.push(m);
                        });

                        const uniqueByEmail = [];
                        const seenEmails = new Set();
                        participants.forEach((p) => {
                          const em = p && p.email ? String(p.email).toLowerCase() : '';
                          if (!em || seenEmails.has(em)) return;
                          seenEmails.add(em);
                          uniqueByEmail.push(p);
                        });

                        const allowedParticipants = uniqueByEmail.filter((p) => {
                          const email = p && p.email ? String(p.email).toLowerCase() : '';
                          return email && memberByEmail.has(email);
                        });

                        const avatarsToShow = allowedParticipants.slice(0, 3);
                        const remainingAvatarCount = Math.max(0, allowedParticipants.length - avatarsToShow.length);

                        const isExpandedItem = expandedHistoryId === id;
                        const isSelectedItem = selectedHistoryId === id;

                        const isLabelGroup = String(type || '').toLowerCase() === 'label' && Array.isArray(item.labelGroups);
                        const subtitle = isLabelGroup
                          ? `label • ${item.labelGroups.map((lg) => lg.labelType).filter(Boolean).join(', ')}`
                          : `${type ? String(type) : ''}${key ? ` • ${String(key)}` : ''}`.trim();

                        const showPills = isLabelGroup
                          ? item.labelGroups.some((lg) => Array.isArray(lg.options) && lg.options.filter(Boolean).length > 0)
                          : (String(type || '').toLowerCase() === 'label' && Array.isArray(options) && options.filter(Boolean).length > 0);

                        const translateX = Number((historyRowTranslateX && historyRowTranslateX[id]) || 0);
                        const isSwipable = Boolean(highlightID);
                        const isDeletingRow = Boolean(historyRowDeleting && historyRowDeleting[id]);

                        return (
                          <div
                            key={id}
                            style={{
                              position: 'relative',
                              overflow: 'hidden',
                              borderRadius: '10px',
                              width: '100%',
                              display: 'block',
                              flexShrink: 0,
                              marginBottom: '10px'
                            }}
                          >
                            {isSwipable && (
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  paddingRight: '16px',
                                  background: '#fca5a5',
                                  opacity: isDeletingRow
                                    ? 0
                                    : (translateX < -6 ? Math.min(1, Math.max(0, (-translateX - 6) / 80)) : 0),
                                  transition: 'opacity 120ms cubic-bezier(0.22, 1, 0.36, 1)',
                                  pointerEvents: 'none'
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18" />
                                  <path d="M8 6V4h8v2" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                </svg>
                              </div>
                            )}
                            <button
                              type="button"
                              onTouchStart={(e) => {
                                if (!isSwipable) return;
                                const t = e.touches && e.touches[0];
                                if (!t) return;
                                const now = Date.now();
                                const width = e.currentTarget.getBoundingClientRect().width;
                                swipeDragRef.current = {
                                  id,
                                  highlightID,
                                  width,
                                  startX: t.clientX,
                                  startY: t.clientY,
                                  baseX: translateX,
                                  isDragging: true,
                                  lockedAxis: null,
                                  lastX: translateX,
                                  prevX: translateX,
                                  lastTs: now,
                                  prevTs: now,
                                  rawX: translateX
                                };
                              }}
                              onTouchMove={(e) => {
                                const s = swipeDragRef.current;
                                if (!s.isDragging || s.id !== id) return;
                                const t = e.touches && e.touches[0];
                                if (!t) return;
                                const dx = t.clientX - s.startX;
                                const dy = t.clientY - s.startY;

                                if (!s.lockedAxis) {
                                  if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
                                  s.lockedAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                                }
                                if (s.lockedAxis !== 'x') return;
                                e.preventDefault();

                                const rawX = s.baseX + dx;
                                s.rawX = rawX;
                                const minX = -Math.max(120, (Number(s.width) || 0) + 80);
                                let nextX = rawX;
                                if (nextX > 0) nextX = 0;
                                if (nextX < minX) {
                                  const overflow = nextX - minX;
                                  nextX = minX + (overflow * 0.25);
                                }
                                const now = Date.now();
                                s.prevX = Number.isFinite(s.lastX) ? s.lastX : 0;
                                s.prevTs = Number.isFinite(s.lastTs) ? s.lastTs : now;
                                s.lastX = nextX;
                                s.lastTs = now;
                                scheduleHistoryRowTranslateX(id, nextX);
                              }}
                              onTouchEnd={() => {
                                const s = swipeDragRef.current;
                                if (s.id !== id) return;
                                swipeDragRef.current.isDragging = false;
                                const curr = Number.isFinite(s.lastX)
                                  ? s.lastX
                                  : Number((historyRowTranslateX && historyRowTranslateX[id]) || 0);
                                const dt = Math.max(1, (Number.isFinite(s.lastTs) ? s.lastTs : 0) - (Number.isFinite(s.prevTs) ? s.prevTs : 0));
                                const dx = curr - (Number.isFinite(s.prevX) ? s.prevX : curr);
                                const v = dx / dt;
                                if (highlightID && shouldCommitSwipeDelete(curr, v, s.width)) {
                                  commitHistoryRowDelete(id, highlightID, s.width, curr);
                                } else {
                                  scheduleHistoryRowTranslateX(id, 0);
                                }
                              }}
                              onMouseDown={(e) => {
                                if (!isSwipable) return;
                                e.preventDefault();
                                const now = Date.now();
                                const width = e.currentTarget.getBoundingClientRect().width;
                                swipeDragRef.current = {
                                  id,
                                  highlightID,
                                  width,
                                  startX: e.clientX,
                                  startY: e.clientY,
                                  baseX: translateX,
                                  isDragging: true,
                                  lockedAxis: null,
                                  lastX: translateX,
                                  prevX: translateX,
                                  lastTs: now,
                                  prevTs: now,
                                  rawX: translateX
                                };
                              }}
                              onClick={() => {
                                // If row is currently open, clicking closes it.
                                if (translateX !== 0) {
                                  setHistoryRowTranslateX((prev) => ({ ...(prev || {}), [id]: 0 }));
                                  return;
                                }

                                // Always select row on single click (even if not truncated)
                                setSelectedHistoryId(id);

                                const now = Date.now();
                                const last = lastHistoryClickRef.current;
                                const isDouble = last.id === id && (now - last.ts) < 300;
                                lastHistoryClickRef.current = { id, ts: now };

                                if (isDouble) {
                                  if (historyClickTimeoutRef.current) {
                                    clearTimeout(historyClickTimeoutRef.current);
                                    historyClickTimeoutRef.current = null;
                                  }
                                  // Double click: navigate to the chat + highlight
                                  if (chatID || highlightID) {
                                    window.dispatchEvent(new CustomEvent('navigateToAnnotationHistoryEntry', {
                                      detail: {
                                        chatID,
                                        highlightID,
                                        project: currentProject
                                      }
                                    }));
                                  }
                                  return;
                                }

                                // Single click (delayed slightly so it won't fire on double-click)
                                if (historyClickTimeoutRef.current) {
                                  clearTimeout(historyClickTimeoutRef.current);
                                }
                                historyClickTimeoutRef.current = setTimeout(() => {
                                  // Only allow expand/collapse if the text is actually truncated
                                  if (truncatedIds.has(id)) {
                                    setExpandedHistoryId((prev) => (prev === id ? null : id));
                                  }
                                  historyClickTimeoutRef.current = null;
                                }, 250);
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                border: '1px solid #e5e7eb',
                                backgroundColor: isSelectedItem ? '#f3f4f6' : '#ffffff',
                                borderRadius: '10px',
                                padding: '9px 11px',
                                paddingBottom: timestamp ? '24px' : '9px',
                                position: 'relative',
                                cursor: 'pointer',
                                transform: `translateX(${translateX}px)`,
                                opacity: isDeletingRow ? 0 : 1,
                                pointerEvents: isDeletingRow ? 'none' : 'auto',
                                willChange: 'transform, opacity',
                                transition: swipeDragRef.current.id === id && swipeDragRef.current.isDragging
                                  ? 'none'
                                  : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                                touchAction: 'pan-y'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isSelectedItem ? '#f3f4f6' : '#ffffff';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                {avatarsToShow.length > 0 ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                    {avatarsToShow.map((p) => {
                                      const email = p && p.email ? String(p.email) : '';
                                      const member = email ? memberByEmail.get(email.toLowerCase()) : null;
                                      const profilePic = member && member.profilePic ? member.profilePic : null;
                                      const firstName = (p && p.firstName) || (member && member.firstName) || '';
                                      const lastName = (p && p.lastName) || (member && member.lastName) || '';
                                      const initials = getUserInitials(firstName, lastName);
                                      const bg = getAvatarColor(email);

                                      return (
                                        <div
                                          key={email || `${String(firstName)}-${String(lastName)}`}
                                          title={email}
                                          style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '999px',
                                            overflow: 'hidden',
                                            position: 'relative',
                                            flexShrink: 0,
                                            border: '1px solid #e5e7eb'
                                          }}
                                        >
                                          <div style={{
                                            display: 'flex',
                                            width: '100%',
                                            height: '100%',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: bg,
                                            color: 'white',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            position: 'absolute',
                                            top: '0px',
                                            left: '0px'
                                          }}>
                                            {initials}
                                          </div>

                                          {profilePic ? (
                                            <img
                                              src={profilePic}
                                              alt={email}
                                              referrerPolicy="no-referrer"
                                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'relative' }}
                                              onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                              }}
                                            />
                                          ) : null}
                                        </div>
                                      );
                                    })}

                                    {remainingAvatarCount > 0 ? (
                                      <button
                                        type="button"
                                        title={`${remainingAvatarCount} more`}
                                        style={{
                                          width: '22px',
                                          height: '22px',
                                          borderRadius: '999px',
                                          border: '1px solid #e5e7eb',
                                          backgroundColor: '#f3f4f6',
                                          color: '#374151',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0,
                                          cursor: 'pointer'
                                        }}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();

                                          const list = allowedParticipants
                                            .map((p) => {
                                              const email = p && p.email ? String(p.email) : '';
                                              const member = email ? memberByEmail.get(email.toLowerCase()) : null;
                                              return {
                                                email,
                                                firstName: (p && p.firstName) || (member && member.firstName) || '',
                                                lastName: (p && p.lastName) || (member && member.lastName) || '',
                                                name: (member && member.name) || (p && p.name) || email,
                                                profilePic: (member && member.profilePic) || null,
                                                ts: (p && p.ts) || ''
                                              };
                                            })
                                            .sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));

                                          setHistoryPeoplePopover({ id, people: list });
                                        }}
                                      >
                                        +{remainingAvatarCount}
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}

                                <div
                                  ref={(el) => {
                                    if (el) historyRefs.current.set(id, el);
                                  }}
                                  style={{
                                    fontSize: '14px',
                                    lineHeight: 1.35,
                                    color: '#111827',
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    minWidth: 0,
                                    flex: 1
                                  }}
                                >
                                  {String(userText)}
                                </div>
                              </div>
                              {(subtitle && !isLabelGroup) && (
                                <div style={{
                                  fontSize: '13px',
                                  lineHeight: 1.3,
                                  color: '#6b7280',
                                  marginTop: '1px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {subtitle}
                                </div>
                              )}

                              {showPills && (
                                <div style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '5px',
                                  marginTop: '5px'
                                }}>
                                  {isLabelGroup ? (
                                    item.labelGroups.flatMap((lg) => {
                                      const colors = getHistoryPillColors(lg.labelType);
                                      return (Array.isArray(lg.options) ? lg.options : []).filter(Boolean).slice(0, 6).map((opt) => (
                                        <span
                                          key={`${id}-${String(lg.labelType)}-${String(opt)}`}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '3px 8px',
                                            borderRadius: '999px',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            lineHeight: 1.3,
                                            backgroundColor: colors.bg,
                                            border: `1px solid ${colors.border}`,
                                            color: colors.text,
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          {String(lg.labelType)}: {String(opt)}
                                        </span>
                                      ));
                                    }).slice(0, 10)
                                  ) : (
                                    options.filter(Boolean).slice(0, 6).map((opt) => {
                                      const colors = getHistoryPillColors(key);
                                      return (
                                        <span
                                          key={`${id}-${String(opt)}`}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '3px 8px',
                                            borderRadius: '999px',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            lineHeight: 1.3,
                                            backgroundColor: colors.bg,
                                            border: `1px solid ${colors.border}`,
                                            color: colors.text,
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          {String(opt)}
                                        </span>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                              {timestamp && (
                                <div style={{
                                  fontSize: '12px',
                                  color: '#9ca3af',
                                  position: 'absolute',
                                  right: '11px',
                                  bottom: '7px'
                                }}>
                                  {formatRelativeTime(timestamp)}
                                </div>
                              )}

                              {truncatedIds.has(id) && (
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateRows: isExpandedItem ? '1fr' : '0fr',
                                    transition: 'grid-template-rows 140ms ease-out',
                                    marginTop: isExpandedItem ? '8px' : '0px'
                                  }}
                                >
                                  <div style={{ overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        fontSize: '13px',
                                        color: '#374151',
                                        lineHeight: 1.5,
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word',
                                        opacity: isExpandedItem ? 1 : 0,
                                        transform: isExpandedItem ? 'translateY(0px)' : 'translateY(-2px)',
                                        transition: 'opacity 120ms ease-out, transform 120ms ease-out'
                                      }}
                                    >
                                      {String(userText)}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </button>

                            {historyPeoplePopover && historyPeoplePopover.id === id && (
                              <div
                                ref={historyPeoplePopoverRef}
                                style={{
                                  position: 'absolute',
                                  right: '10px',
                                  top: '44px',
                                  width: '260px',
                                  background: '#ffffff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '12px',
                                  boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
                                  zIndex: 200,
                                  padding: '10px'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#374151' }}>People</div>
                                  <button
                                    type="button"
                                    onClick={() => setHistoryPeoplePopover(null)}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '8px',
                                      border: '1px solid #e5e7eb',
                                      background: '#ffffff',
                                      cursor: 'pointer',
                                      color: '#6b7280',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                  </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                                  {(historyPeoplePopover.people || []).map((p) => {
                                    const email = String(p.email || '');
                                    const initials = getUserInitials(p.firstName, p.lastName);
                                    const bg = getAvatarColor(email);
                                    return (
                                      <div key={email} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 6px', borderRadius: '10px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '999px', overflow: 'hidden', position: 'relative', border: '1px solid #e5e7eb', flexShrink: 0 }}>
                                          <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: bg, color: 'white', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', position: 'absolute', top: '0px', left: '0px' }}>{initials}</div>
                                          {p.profilePic ? (
                                            <img src={p.profilePic} alt={email} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'relative' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                          ) : null}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                            {String(p.name || email)}
                                          </div>
                                          <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                            {email}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {isHistoryFullscreen && (
                    <div style={{ flexShrink: 0, paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
                      <div
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          const startY = e.clientY;
                          const startH = Number(historyFullscreenListMaxHeight) || 340;

                          const onMove = (ev) => {
                            const dy = ev.clientY - startY;
                            const next = clampHistoryFullscreenListHeight(startH + dy);
                            setHistoryFullscreenListMaxHeight(next);
                          };

                          const onUp = () => {
                            document.removeEventListener('pointermove', onMove, true);
                            document.removeEventListener('pointerup', onUp, true);
                            const next = clampHistoryFullscreenListHeight(Number(historyFullscreenListMaxHeight) || 340);
                            setStoredBoxHeight('sidebar:historyFullscreenListMaxHeight', next);
                          };

                          document.addEventListener('pointermove', onMove, true);
                          document.addEventListener('pointerup', onUp, true);
                        }}
                        onMouseEnter={() => setIsHistoryFullscreenListResizeHover(true)}
                        onMouseLeave={() => setIsHistoryFullscreenListResizeHover(false)}
                        style={{
                          height: '6px',
                          cursor: 'row-resize',
                          borderRadius: '6px',
                          backgroundColor: isHistoryFullscreenListResizeHover ? '#e5e7eb' : 'transparent',
                          margin: '0px 8px 10px 8px'
                        }}
                        title="Drag to resize"
                      />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#374151' }}>Export</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => exportHistoryAsJson(filteredHistoryItems)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              background: '#ffffff',
                              color: '#374151',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                            }}
                            title="Download JSON"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            JSON
                          </button>

                          <button
                            type="button"
                            onClick={() => exportHistoryAsCsv(filteredHistoryItems)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              background: '#ffffff',
                              color: '#374151',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                            }}
                            title="Download CSV"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            CSV
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Unified Annotation Statistics Section */}
      {!isExpanded && !isHistoryFullscreen && (
        <div ref={statsBoxRef} style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          padding: '12px',
          paddingBottom: '4px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          height: `${isStatsVisible ? statsBoxHeight : 56}px`,
          maxHeight: '100%',
          order: getBoxOrderIndex('stats'),
          opacity: draggingBoxId === 'stats' ? 0.65 : 1,
          outline: dragOverBoxId === 'stats' && draggingBoxId && draggingBoxId !== 'stats' ? '2px dashed #60a5fa' : 'none',
          outlineOffset: '2px'
        }}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggingBoxId && draggingBoxId !== 'stats') setDragOverBoxId('stats');
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (draggingBoxId && draggingBoxId !== 'stats') setDragOverBoxId('stats');
          }}
          onDragLeave={() => {
            if (dragOverBoxId === 'stats') setDragOverBoxId(null);
          }}
          onDrop={() => dropBoxOn('stats')}
        >
          {isStatsVisible && (
            <div
              onMouseDown={(e) => beginResizeHeight(e, { boxId: 'stats', storageKey: 'sidebarBoxHeight:annotationStats', setHeight: setStatsBoxHeight, boxRef: statsBoxRef, edge: 'top' })}
              style={{
                position: 'absolute',
                left: '8px',
                right: '8px',
                top: '0px',
                height: '6px',
                cursor: 'row-resize',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                zIndex: 6
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              role="separator"
              aria-orientation="horizontal"
              tabIndex={-1}
            />
          )}
          {isStatsVisible && (
            <div
              onPointerDown={(e) => beginResizeHeight(e, { boxId: 'stats', storageKey: 'sidebarBoxHeight:annotationStats', setHeight: setStatsBoxHeight, boxRef: statsBoxRef, edge: 'bottom' })}
              style={{
                position: 'absolute',
                left: '8px',
                right: '8px',
                bottom: '0px',
                height: '6px',
                cursor: 'row-resize',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                zIndex: 50,
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              role="separator"
              aria-orientation="horizontal"
              tabIndex={-1}
            />
          )}
          <div className="stats-header" style={{
            padding: '0 0 8px 0',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                draggable
                onDragStart={(e) => beginDragBox(e, 'stats', statsBoxRef)}
                onDragEnd={() => setDraggingBoxId(null)}
                title="Drag to reorder"
                style={{
                  width: '10px',
                  height: '18px',
                  marginRight: '8px',
                  cursor: 'grab',
                  opacity: 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none'
                }}
              >
                <div style={{ width: '2px', height: '14px', backgroundColor: '#d1d5db', borderRadius: '2px', boxShadow: '4px 0 0 #d1d5db' }} />
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: '6px', color: 'var(--color-dark-gray, #374151)' }}
              >
                <path d="M3 3v18h18" />
                <path d="M7 16v-6" />
                <path d="M12 16v-10" />
                <path d="M17 16v-3" />
              </svg>
              <span style={{
                marginRight: '26px',
                color: 'var(--color-dark-gray, #374151)',
                fontSize: '14px',
                fontWeight: 500
              }}>
                Annotation Statistics
              </span>
            </div>
            <button
              onClick={() => setIsStatsVisible(!isStatsVisible)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: '#6b7280',
                transition: 'all 0.2s',
                padding: '0'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }}
              title={isStatsVisible ? 'Hide statistics' : 'Show statistics'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: isStatsVisible ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              >
                <path d="m6 9 6 6 6-6"></path>
              </svg>
            </button>
          </div>
          {isStatsVisible && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: '8px' }}>
              {isLoadingStats ? (
                <div className="statistics-container" style={{
                  backgroundColor: '#f7f7f8',
                  margin: '0 0 12px 0',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  gap: '12px',
                  alignItems: 'center'
                }}>
                  {/* Annotations skeleton */}
                  <div className="stat-item" style={{ justifySelf: 'start' }}>
                    <div style={{
                      height: '10px',
                      width: '70px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      marginBottom: '4px',
                      animation: 'pulse 1.5s ease-in-out infinite'
                    }}></div>
                    <div style={{
                      height: '20px',
                      width: '24px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      animation: 'pulse 1.5s ease-in-out infinite'
                    }}></div>
                  </div>
                  {/* Total Labels skeleton */}
                  <div className="stat-item" style={{ justifySelf: 'center' }}>
                    <div style={{
                      height: '10px',
                      width: '75px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      marginBottom: '4px',
                      animation: 'pulse 1.5s ease-in-out infinite'
                    }}></div>
                    <div style={{
                      height: '20px',
                      width: '20px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      animation: 'pulse 1.5s ease-in-out infinite'
                    }}></div>
                  </div>
                  {/* Last Annotation skeleton */}
                  <div className="stat-item" style={{ justifySelf: 'end' }}>
                    <div style={{
                      height: '10px',
                      width: '90px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      marginBottom: '4px',
                      animation: 'pulse 1.5s ease-in-out infinite'
                    }}></div>
                    <div style={{
                      height: '20px',
                      width: '50px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      animation: 'pulse 1.5s ease-in-out infinite'
                    }}></div>
                  </div>
                </div>
              ) : (
                <div className="statistics-container" style={{
                  backgroundColor: '#f7f7f8',
                  margin: '0 0 12px 0',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  gap: '12px',
                  alignItems: 'center'
                }}>
                  <div className="stat-item" style={{ justifySelf: 'start' }}>
                    <span className="stat-label" style={{
                      fontWeight: 400,
                      color: '#6b7280',
                      marginBottom: '4px',
                      fontSize: '0.7rem',
                      letterSpacing: '0.025em',
                      whiteSpace: 'nowrap',
                      display: 'block'
                    }}>
                      Annotations:
                    </span>
                    <span className="stat-value" style={{
                      fontWeight: 500,
                      color: '#111827',
                      fontSize: '1rem',
                      lineHeight: '1.2',
                      display: 'block'
                    }}>
                      {stats.annotationCount}
                    </span>
                  </div>
                  <div className="stat-item" style={{ justifySelf: 'center' }}>
                    <span className="stat-label" style={{
                      fontWeight: 400,
                      color: '#6b7280',
                      marginBottom: '4px',
                      fontSize: '0.7rem',
                      letterSpacing: '0.025em',
                      whiteSpace: 'nowrap',
                      display: 'block'
                    }}>
                      Total Labels:
                    </span>
                    <span className="stat-value" style={{
                      fontWeight: 500,
                      color: '#111827',
                      fontSize: '1rem',
                      lineHeight: '1.2',
                      display: 'block'
                    }}>
                      {stats.labelCount}
                    </span>
                  </div>
                  <div className="stat-item" style={{ justifySelf: 'end' }}>
                    <span className="stat-label" style={{
                      fontWeight: 400,
                      color: '#6b7280',
                      marginBottom: '4px',
                      fontSize: '0.7rem',
                      letterSpacing: '0.025em',
                      whiteSpace: 'nowrap',
                      display: 'block'
                    }}>
                      Last Annotation:
                    </span>
                    <span className="stat-value" style={{
                      fontWeight: 500,
                      color: '#111827',
                      fontSize: '1rem',
                      lineHeight: '1.2',
                      display: 'block'
                    }}>
                      {stats.lastAnnotationText}
                    </span>
                  </div>
                </div>
              )}
              {chartData && chartData.length > 0 && chartData.some(item => item.value > 0) && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  padding: '0 4px'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                    Activity Chart
                  </div>
                  <button
                    onClick={() => setIsChartVisible(!isChartVisible)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      color: '#6b7280',
                      transition: 'all 0.2s',
                      padding: '0'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.color = '#374151';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#6b7280';
                    }}
                    title={isChartVisible ? 'Hide chart' : 'Show chart'}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: isChartVisible ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}
                    >
                      <path d="m6 9 6 6 6-6"></path>
                    </svg>
                  </button>
                </div>
              )}
              {isLoadingStats && chartData && chartData.length > 0 && chartData.some(item => item.value > 0) ? (
                <div style={{
                  height: '150px',
                  width: '100%',
                  paddingBottom: '8px',
                  paddingLeft: '0',
                  paddingRight: '0',
                  overflow: 'visible',
                  minHeight: '150px',
                  position: 'relative'
                }}>
                  {/* Chart area skeleton - curved line shape */}
                  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="skeleton-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#e5e7eb" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 12 140 Q 60 120, 108 100 T 204 80 T 300 70 T 396 75 T 492 85"
                      stroke="#e5e7eb"
                      strokeWidth="2"
                      fill="none"
                      style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
                    />
                    <path
                      d="M 12 140 Q 60 120, 108 100 T 204 80 T 300 70 T 396 75 T 492 85 L 492 140 L 12 140 Z"
                      fill="url(#skeleton-gradient)"
                      style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
                    />
                  </svg>
                  {/* Day labels skeleton */}
                  <div style={{
                    position: 'absolute',
                    bottom: '28px',
                    left: '12px',
                    right: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                      <div key={day} style={{
                        flex: 1,
                        height: '12px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        animation: 'pulse 1.5s ease-in-out infinite',
                        animationDelay: `${i * 0.1}s`
                      }}></div>
                    ))}
                  </div>
                </div>
              ) : (
                isChartVisible && chartData && chartData.length > 0 && chartData.some(item => item.value > 0) && (
                  <div style={{
                    height: '150px',
                    width: '100%',
                    paddingBottom: '8px',
                    paddingLeft: '0',
                    paddingRight: '0',
                    overflow: 'visible',
                    minHeight: '150px'
                  }}>
                    <MinimalistAreaChart data={chartData} />
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Project Members Section */}
      {!isExpanded && !isHistoryFullscreen && projectMembers.length > 0 && (
        <div ref={membersBoxRef} style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          padding: '12px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          height: `${isMembersVisible ? membersBoxHeight : 56}px`,
          maxHeight: '100%',
          order: getBoxOrderIndex('members'),
          opacity: draggingBoxId === 'members' ? 0.65 : 1,
          outline: dragOverBoxId === 'members' && draggingBoxId && draggingBoxId !== 'members' ? '2px dashed #60a5fa' : 'none',
          outlineOffset: '2px'
        }}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggingBoxId && draggingBoxId !== 'members') setDragOverBoxId('members');
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (draggingBoxId && draggingBoxId !== 'members') setDragOverBoxId('members');
          }}
          onDragLeave={() => {
            if (dragOverBoxId === 'members') setDragOverBoxId(null);
          }}
          onDrop={() => dropBoxOn('members')}
        >
          {isMembersVisible && (
            <div
              onMouseDown={(e) => beginResizeHeight(e, { boxId: 'members', storageKey: 'sidebarBoxHeight:projectMembers', setHeight: setMembersBoxHeight, boxRef: membersBoxRef, edge: 'top' })}
              style={{
                position: 'absolute',
                left: '8px',
                right: '8px',
                top: '0px',
                height: '6px',
                cursor: 'row-resize',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                zIndex: 6
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              role="separator"
              aria-orientation="horizontal"
              tabIndex={-1}
            />
          )}
          {isMembersVisible && (
            <div
              onPointerDown={(e) => beginResizeHeight(e, { boxId: 'members', storageKey: 'sidebarBoxHeight:projectMembers', setHeight: setMembersBoxHeight, boxRef: membersBoxRef, edge: 'bottom' })}
              style={{
                position: 'absolute',
                left: '8px',
                right: '8px',
                bottom: '0px',
                height: '6px',
                cursor: 'row-resize',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                zIndex: 50,
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              role="separator"
              aria-orientation="horizontal"
              tabIndex={-1}
            />
          )}
          <div style={{
            padding: '0 0 8px 0',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                draggable
                onDragStart={(e) => beginDragBox(e, 'members', membersBoxRef)}
                onDragEnd={() => setDraggingBoxId(null)}
                title="Drag to reorder"
                style={{
                  width: '10px',
                  height: '18px',
                  marginRight: '8px',
                  cursor: 'grab',
                  opacity: 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none'
                }}
              >
                <div style={{ width: '2px', height: '14px', backgroundColor: '#d1d5db', borderRadius: '2px', boxShadow: '4px 0 0 #d1d5db' }} />
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                style={{ marginRight: '6px', color: 'var(--color-dark-gray, #374151)' }}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span style={{
                color: 'var(--color-dark-gray, #374151)',
                fontSize: '14px',
                fontWeight: 500
              }}>
                Project Members
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                backgroundColor: '#f3f4f6',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500',
                color: '#4b5563'
              }}>
                {projectMembers.length}
              </span>
              <button
                onClick={() => setIsMembersVisible(!isMembersVisible)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: '#6b7280',
                  transition: 'all 0.2s',
                  padding: '0'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
                title={isMembersVisible ? 'Hide members' : 'Show members'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: isMembersVisible ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}
                >
                  <path d="m6 9 6 6 6-6"></path>
                </svg>
              </button>
            </div>
          </div>

          {isMembersVisible && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* Search Bar */}
              {!isLoadingMembers && (
                <div style={{
                  position: 'relative',
                  marginBottom: '12px'
                }}>
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={memberSearchTerm}
                    onChange={(e) => setMemberSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 10px 10px 36px',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'all 0.2s',
                      backgroundColor: '#f3f4f6',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(229, 231, 235, 0.5)',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(59, 130, 246, 0.5)';
                    }}
                    onBlur={(e) => {
                      e.target.style.backgroundColor = '#f3f4f6';
                      e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(229, 231, 235, 0.5)';
                    }}
                  />
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      pointerEvents: 'none'
                    }}
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                </div>
              )}

              {isLoadingMembers ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '100%',
                  overflowY: 'auto',
                  paddingRight: '4px',
                  flex: 1,
                  minHeight: 0
                }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px',
                        borderRadius: '8px'
                      }}
                    >
                      {/* Avatar Skeleton with presence indicator */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: '#e5e7eb',
                          animation: 'pulse 1.5s ease-in-out infinite'
                        }}></div>
                        {/* Presence indicator skeleton */}
                        <div style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '0px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#d1d5db',
                          border: '2px solid white',
                          animation: 'pulse 1.5s ease-in-out infinite'
                        }}></div>
                      </div>

                      {/* Text Skeleton with role badge */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '2px'
                        }}>
                          <div style={{
                            height: '16px',
                            width: i === 1 ? '100px' : i === 2 ? '120px' : i === 3 ? '90px' : '110px',
                            backgroundColor: '#e5e7eb',
                            borderRadius: '4px',
                            animation: 'pulse 1.5s ease-in-out infinite',
                            flex: 1
                          }}></div>
                          {/* Role badge skeleton */}
                          <div style={{
                            height: '20px',
                            width: i === 1 ? '50px' : i === 2 ? '45px' : i === 3 ? '55px' : '50px',
                            backgroundColor: '#e5e7eb',
                            borderRadius: '12px',
                            animation: 'pulse 1.5s ease-in-out infinite',
                            flexShrink: 0
                          }}></div>
                        </div>
                        <div style={{
                          height: '12px',
                          width: i === 1 ? '140px' : i === 2 ? '160px' : i === 3 ? '150px' : '145px',
                          backgroundColor: '#e5e7eb',
                          borderRadius: '4px',
                          animation: 'pulse 1.5s ease-in-out infinite',
                          marginTop: '2px'
                        }}></div>
                      </div>

                      {/* Profile button skeleton */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: '#e5e7eb',
                        flexShrink: 0,
                        animation: 'pulse 1.5s ease-in-out infinite'
                      }}></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '100%',
                  overflowY: 'auto',
                  paddingRight: '4px',
                  flex: 1,
                  minHeight: 0
                }}>
                  {projectMembers
                    .filter(member => {
                      if (!memberSearchTerm) return true;
                      const searchLower = memberSearchTerm.toLowerCase();
                      const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name;
                      return name.toLowerCase().includes(searchLower) || member.email.toLowerCase().includes(searchLower);
                    })
                    .sort((a, b) => {
                      // Current user first
                      const isCurrentA = auth.currentUser?.email === a.email;
                      const isCurrentB = auth.currentUser?.email === b.email;
                      if (isCurrentA && !isCurrentB) return -1;
                      if (!isCurrentA && isCurrentB) return 1;
                      // Then alphabetical by name
                      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || '';
                      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.name || '';
                      return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
                    })
                    .map((member) => {
                      const presence = memberPresence[member.email] || 'offline';
                      const isCurrentUser = auth.currentUser?.email === member.email;

                      return (
                        <div
                          key={member.email}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '8px',
                            borderRadius: '8px',
                            backgroundColor: isCurrentUser ? '#f9fafb' : 'transparent'
                          }}
                        >
                          {/* Avatar */}
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            {member.profilePic ? (
                              <img
                                src={member.profilePic}
                                alt={member.name}
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '1px solid #e5e7eb',
                                  display: 'block'
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  const fallback = e.target.nextElementSibling;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div
                              style={{
                                display: member.profilePic ? 'none' : 'flex',
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: '500',
                                border: '1px solid #e5e7eb',
                                backgroundColor: `hsl(${member.email.charCodeAt(0) * 10 % 360}, 60%, 70%)`,
                                color: 'white',
                                textTransform: 'uppercase'
                              }}
                            >
                              {(() => {
                                const firstInitial = member.firstName && member.firstName.trim() ? member.firstName.trim()[0].toUpperCase() : '';
                                const lastInitial = member.lastName && member.lastName.trim() ? member.lastName.trim()[0].toUpperCase() : '';
                                if (firstInitial && lastInitial) {
                                  return firstInitial + lastInitial;
                                } else if (firstInitial) {
                                  return firstInitial + firstInitial;
                                }
                                return 'U';
                              })()}
                            </div>
                            {/* Presence Status Indicator */}
                            <div style={{
                              position: 'absolute',
                              bottom: '-2px',
                              right: '0px',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: getPresenceColor(presence),
                              border: '2px solid white',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }} title={getPresenceLabel(presence)} />
                          </div>

                          {/* Text Info */}
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '2px'
                            }}>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: 500,
                                color: '#111827',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1
                              }}>
                                {member.firstName && member.lastName
                                  ? `${member.firstName} ${member.lastName}`
                                  : member.name}
                                {isCurrentUser && (
                                  <span style={{
                                    marginLeft: '6px',
                                    fontSize: '12px',
                                    color: '#6b7280',
                                    fontWeight: 400
                                  }}>
                                    (You)
                                  </span>
                                )}
                              </div>
                              {/* Role Badge */}
                              {(() => {
                                const roleColors = {
                                  owner: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
                                  editor: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
                                  member: { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' },
                                  viewer: { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' }
                                };
                                const roleColor = roleColors[member.role] || roleColors.member;
                                const roleLabel = member.role === 'owner' ? 'Owner' : member.role === 'editor' ? 'Editor' : 'Viewer';

                                return (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    fontWeight: '500',
                                    borderRadius: '12px',
                                    backgroundColor: roleColor.bg,
                                    color: roleColor.text,
                                    border: `1px solid ${roleColor.border}`,
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                  }}>
                                    {roleLabel}
                                  </span>
                                );
                              })()}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {member.email}
                            </div>
                          </div>

                          {/* Profile Icon Button */}
                          {onViewMember && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewMember(member.email, member.userCompanyEmail);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                cursor: 'pointer',
                                color: '#6b7280',
                                transition: 'all 0.2s',
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.color = '#374151';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#6b7280';
                              }}
                              title="View profile"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Activity Feed Section */}
      {!isHistoryFullscreen && (
        <div ref={activityBoxRef} style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '100%',
          alignSelf: 'stretch',
          padding: '12px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          flex: 'unset',
          minHeight: showActivityBody ? 0 : '56px',
          height: typeof renderCommentsContent === 'function'
            ? (showActivityBody ? 'auto' : 'auto')
            : `${Math.max(56, Number(activityBoxHeight) || 56)}px`,
          maxHeight: typeof renderCommentsContent === 'function' && showActivityBody ? 'none' : '100%',
          order: getBoxOrderIndex('activity'),
          opacity: draggingBoxId === 'activity' ? 0.65 : 1,
          outline: dragOverBoxId === 'activity' && draggingBoxId && draggingBoxId !== 'activity' ? '2px dashed #60a5fa' : 'none',
          outlineOffset: '2px'
        }}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggingBoxId && draggingBoxId !== 'activity') setDragOverBoxId('activity');
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (draggingBoxId && draggingBoxId !== 'activity') setDragOverBoxId('activity');
          }}
          onDragLeave={() => {
            if (dragOverBoxId === 'activity') setDragOverBoxId(null);
          }}
          onDrop={() => dropBoxOn('activity')}
        >
          {!(typeof renderCommentsContent === 'function' && showActivityBody) && (
            <>
              <div
                onPointerDown={(e) => {
                  beginResizeHeight(e, {
                    boxId: 'activity',
                    storageKey: 'sidebarBoxHeight:activity',
                    setHeight: setActivityBoxHeight,
                    boxRef: activityBoxRef,
                    edge: 'top',
                    startHeightOverride: !showActivityBody ? activityBoxHeight : undefined
                  });
                }}
                style={{
                  position: 'absolute',
                  left: '8px',
                  right: '8px',
                  top: '0px',
                  height: '6px',
                  cursor: 'row-resize',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  zIndex: 50,
                  pointerEvents: 'auto'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                role="separator"
                aria-orientation="horizontal"
                tabIndex={-1}
              />
              <div
                onPointerDown={(e) => {
                  beginResizeHeight(e, {
                    boxId: 'activity',
                    storageKey: 'sidebarBoxHeight:activity',
                    setHeight: setActivityBoxHeight,
                    boxRef: activityBoxRef,
                    edge: 'bottom',
                    startHeightOverride: !showActivityBody ? activityBoxHeight : undefined
                  });
                }}
                style={{
                  position: 'absolute',
                  left: '8px',
                  right: '8px',
                  bottom: '0px',
                  height: '6px',
                  cursor: 'row-resize',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  zIndex: 50,
                  pointerEvents: 'auto'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                role="separator"
                aria-orientation="horizontal"
                tabIndex={-1}
              />
            </>
          )}

          <div style={{
            padding: showActivityBody ? '0 0 12px 0' : '0 0 8px 0',
            marginBottom: showActivityBody ? '12px' : '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            boxSizing: 'border-box',
            minWidth: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div
                draggable
                onDragStart={(e) => beginDragBox(e, 'activity', activityBoxRef)}
                onDragEnd={() => setDraggingBoxId(null)}
                title="Drag to reorder"
                style={{
                  width: '10px',
                  height: '18px',
                  cursor: 'grab',
                  opacity: 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                  flexShrink: 0
                }}
              >
                <div style={{ width: '2px', height: '14px', backgroundColor: '#d1d5db', borderRadius: '2px', boxShadow: '4px 0 0 #d1d5db' }} />
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: '#6b7280', flexShrink: 0 }}
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span style={{
                color: 'var(--color-dark-gray, #374151)',
                fontSize: '14px',
                fontWeight: 500,
                minWidth: 0
              }}>
                Comments
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {onToggleExpand && (
                <button
                  onClick={() => {
                    onToggleExpand();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    color: '#6b7280',
                    transition: 'all 0.2s',
                    padding: '0'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = '#374151';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#6b7280';
                  }}
                  title={isExpanded ? 'Minimize' : 'Expand'}
                  type="button"
                >
                  {isExpanded ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="4 14 10 14 10 20" />
                      <polyline points="20 10 14 10 14 4" />
                      <line x1="14" y1="10" x2="21" y2="3" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>

          {typeof renderCommentsContent === 'function' ? (
            /* Comments: show in both minimized and expanded; minimized = compact strip */
            <div style={{
              flex: showActivityBody ? 1 : 'none',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              ...(showActivityBody ? {} : { maxHeight: '220px', overflowY: 'auto' })
            }}>
              {renderCommentsContent()}
            </div>
          ) : showActivityBody ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Filter Pills (default when no comments slot) */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px',
                flexWrap: 'wrap'
              }}>
                {['All', 'Mentions', 'Annotations', 'Sharing', 'Messages'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActivityFilter(filter)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '16px',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: activityFilter === filter ? '#111827' : '#f3f4f6',
                      color: activityFilter === filter ? '#ffffff' : '#6b7280',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      if (activityFilter !== filter) {
                        e.currentTarget.style.backgroundColor = '#e5e7eb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activityFilter !== filter) {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }
                    }}
                    type="button"
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <div style={{
                flex: 1,
                color: '#6b7280',
                fontSize: '13px',
                overflowY: 'auto',
                maxHeight: '100%',
                minHeight: 0
              }}>
                <div style={{ color: '#9ca3af', fontSize: '13px' }}>
                  {activityFilter === 'All' && 'No activity to show'}
                  {activityFilter === 'Mentions' && 'No mentions to show'}
                  {activityFilter === 'Annotations' && 'No annotations to show'}
                  {activityFilter === 'Sharing' && 'No sharing to show'}
                  {activityFilter === 'Messages' && 'No messages to show'}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default Activity;
