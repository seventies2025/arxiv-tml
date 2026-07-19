export const TOPICS = [
  {
    id: "theory-ml",
    name: "理论机器学习",
    nameEn: "Theoretical ML",
    description: "机器学习理论基础、统计学习理论、泛化误差分析",
    query: "(cat:cs.LG OR cat:stat.ML) AND (all:\"statistical learning theory\" OR all:\"generalization\" OR all:\"PAC learning\" OR all:\"VC dimension\" OR all:\"Rademacher complexity\")",
    sort: "submittedDate",
    icon: "∀"
  },
  {
    id: "quantum-ml",
    name: "量子机器学习",
    nameEn: "Quantum ML",
    description: "量子计算与机器学习的交叉、量子神经网络、量子数据处理",
    query: "(cat:quant-ph OR cat:cs.LG) AND (all:\"quantum machine learning\" OR all:\"quantum neural network\" OR all:\"quantum computing\" OR all:\"QML\" OR all:\"quantum data\")",
    sort: "submittedDate",
    icon: "|ψ⟩"
  },
  {
    id: "optimization",
    name: "优化理论",
    nameEn: "Optimization",
    description: "凸优化、非凸优化、随机优化、梯度方法理论分析",
    query: "(cat:cs.LG OR cat:math.OC OR cat:stat.ML) AND (all:\"convex optimization\" OR all:\"non-convex optimization\" OR all:\"stochastic gradient\" OR all:\"gradient descent\" OR all:\"optimization theory\")",
    sort: "submittedDate",
    icon: "∇"
  },
  {
    id: "representation",
    name: "表示学习",
    nameEn: "Representation Learning",
    description: "深度学习表示理论、特征学习、降维方法、流形学习",
    query: "(cat:cs.LG OR cat:stat.ML) AND (all:\"representation learning\" OR all:\"feature learning\" OR all:\"manifold learning\" OR all:\"dimensionality reduction\" OR all:\"embedding\")",
    sort: "submittedDate",
    icon: "⟨·⟩"
  },
  {
    id: "deep-learning-theory",
    name: "深度学习理论",
    nameEn: "Deep Learning Theory",
    description: "深度神经网络的理论分析、表达能力、优化 Landscape、泛化性",
    query: "(cat:cs.LG OR cat:stat.ML) AND (all:\"deep learning theory\" OR all:\"neural network expressivity\" OR all:\"loss landscape\" OR all:\"depth separation\" OR all:\"overparameterization\")",
    sort: "submittedDate",
    icon: "⊗"
  },
  {
    id: "reinforcement-learning-theory",
    name: "强化学习理论",
    nameEn: "RL Theory",
    description: "强化学习的理论基础、马尔可夫决策过程、样本复杂度、收敛分析",
    query: "(cat:cs.LG OR cat:cs.AI) AND (all:\"reinforcement learning theory\" OR all:\"MDP\" OR all:\"sample complexity\" OR all:\"PAC RL\" OR all:\"convergence analysis\")",
    sort: "submittedDate",
    icon: "π"
  },
  {
    id: "information-theory",
    name: "信息论与ML",
    nameEn: "Information Theory",
    description: "信息论视角下的机器学习、互信息、信息瓶颈、最小描述长度",
    query: "(cat:cs.IT OR cat:cs.LG OR cat:stat.ML) AND (all:\"information theory\" OR all:\"mutual information\" OR all:\"information bottleneck\" OR all:\"MDL\" OR all:\"rate distortion\")",
    sort: "submittedDate",
    icon: "I(X;Y)"
  },
  {
    id: "probabilistic-ml",
    name: "概率机器学习",
    nameEn: "Probabilistic ML",
    description: "贝叶斯方法、概率图模型、变分推断、马尔可夫链蒙特卡洛",
    query: "(cat:cs.LG OR cat:stat.ML OR cat:stat.AP) AND (all:\"probabilistic machine learning\" OR all:\"Bayesian\" OR all:\"graphical model\" OR all:\"variational inference\" OR all:\"MCMC\")",
    sort: "submittedDate",
    icon: "P(X)"
  },
  {
    id: "complexity-theory",
    name: "计算复杂度",
    nameEn: "Computational Complexity",
    description: "机器学习问题的计算复杂度、学习难度下界、算法效率分析",
    query: "(cat:cs.CC OR cat:cs.LG) AND (all:\"computational complexity\" OR all:\"learning complexity\" OR all:\"lower bound\" OR all:\"hardness of learning\" OR all:\"exponential time\")",
    sort: "submittedDate",
    icon: "O(·)"
  },
  {
    id: "quantum-algorithms",
    name: "量子算法",
    nameEn: "Quantum Algorithms",
    description: "量子算法设计、量子加速、量子线性代数、量子优化",
    query: "cat:quant-ph AND (all:\"quantum algorithm\" OR all:\"quantum speedup\" OR all:\"quantum linear algebra\" OR all:\"quantum optimization\" OR all:\"Shor's algorithm\")",
    sort: "submittedDate",
    icon: "U"
  },
  {
    id: "quantum-error-mitigation",
    name: "量子纠错与缓解",
    nameEn: "Quantum Error Mitigation",
    description: "量子计算中的噪声处理、误差缓解技术、量子纠错码",
    query: "cat:quant-ph AND (all:\"quantum error correction\" OR all:\"error mitigation\" OR all:\"noise\" OR all:\"fault tolerance\" OR all:\"QEC\")",
    sort: "submittedDate",
    icon: "⊕"
  },
  {
    id: "foundation-models",
    name: "大模型基础",
    nameEn: "Foundation Models",
    description: "大语言模型理论、涌现能力、对齐理论、可解释性",
    query: "(cat:cs.LG OR cat:cs.CL) AND (all:\"foundation model\" OR all:\"large language model\" OR all:\"emergent ability\" OR all:\"alignment\" OR all:\"interpretability\")",
    sort: "submittedDate",
    icon: "LLM"
  }
];

export function getTopicById(id) {
  return TOPICS.find((t) => t.id === id);
}

export const TREND_TERMS = [
  "量子机器学习",
  "量子神经网络",
  "统计学习理论",
  "深度学习理论",
  "强化学习理论",
  "信息瓶颈",
  "大模型涌现",
  "量子纠错",
  "泛化误差",
  "表示学习",
  "概率图模型",
  "变分推断",
  "计算复杂度",
  "量子算法",
  "优化理论"
];