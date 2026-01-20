//Please do not include imports/references from any other javascript files here, since share.html will have issues trying to run them since it imports from this file
export const labelMap = {
    Sentiment: ['Positive', 'Neutral', 'Negative'],
    Tone: ['Formal', 'Informal', 'Friendly', 'Hostile'],
    Intent: ['Request', 'Inform', 'Suggestion', 'Complaint'],
    Emotion: ['Happy', 'Sad', 'Angry', 'Surprised'],
    Priority: ['High', 'Medium', 'Low'],
    Politeness: ['Polite', 'Neutral', 'Rude'],
    Agreement: ['Agree', 'Disagree'],
    Relevance: ['Relevant', 'Irrelevant']
};

export const codeMap = {
    "Interaction Quality": ['Clarity of Response', 'Relevance of Information', 'Completeness of Answer', 'Promptness of Response'],
    "User Experience": ['Ease of Use', 'Interface Navigation', 'Feedback Mechanism', 'Error Handling'],
    "AI Understanding": ['Context Grasping', 'Misinterpretations', 'Follow-up Accuracy', 'Personalization Effectiveness'],
    "Technical Performance": ['Response Time', 'System Reliability', 'Integration with Other Tools', 'Scalability Issues'],
    "Ethical And Safety Concerns": ['Bias Detection', 'Data Privacy', 'Ethical Use', 'Content Appropriateness'],
    "User Engagement": ['User Retention', 'Interaction Depth', 'User Satisfaction', 'Longevity'],
    "Technical Support": ['Installation Problems', 'Software Bugs', 'Upgrade Issues', 'Compatibility Issues'],
    "Customer Relations": ['Compliment', 'Code-Complaint', 'Code-Suggestion', 'Feedback']
};

export const isOnWebsite = true;