/**
 * BloomSocial 完整经济模型分析与优化
 * 
 * 核心问题：
 * 1. 在 70-25-5 的比例下，用户有可能收益吗？
 * 2. 在当前权重函数不变的情况下，找到较优比例，使前 10% 左右的用户能获利。
 */

// ========== 配置参数 ==========
const LIKE_AMOUNT = 100;

// 权重函数参数
const w_max = 1.0;
const w_min = 0.2;
const k = 0.20;

// ========== 权重函数实现 ==========
function getWeight(i: number): number {
  return w_min + (w_max - w_min) * Math.exp(-k * (i - 1));
}

function calculateTotalWeight(likerCount: number): number {
  let sum = 0;
  for (let i = 1; i <= likerCount; i++) {
    sum += getWeight(i);
  }
  return sum;
}

// ========== 核心分析函数 ==========
interface AnalysisResult {
  authorBps: number;
  likerBps: number;
  protocolBps: number;
  likerCount: number;
  totalInvestment: number;
  likerRewardPool: number;
  profitableCount: number;
  profitablePercent: number;
  allProfits: number[];
  firstLikerProfit: number;
}

function analyzeRatio(
  authorBps: number,
  likerBps: number,
  protocolBps: number,
  likerCount: number
): AnalysisResult {
  const totalInvestment = likerCount * LIKE_AMOUNT;
  const likerRewardPool = (totalInvestment * likerBps) / 10000;
  const totalWeight = calculateTotalWeight(likerCount);

  const allProfits: number[] = [];
  let profitableCount = 0;
  let firstLikerProfit = 0;

  for (let i = 1; i <= likerCount; i++) {
    const weight = getWeight(i);
    const reward = (likerRewardPool * weight) / totalWeight;
    const profit = reward - LIKE_AMOUNT;

    allProfits.push(profit);
    if (profit >= 0) profitableCount++;
    if (i === 1) firstLikerProfit = profit;
  }

  return {
    authorBps,
    likerBps,
    protocolBps,
    likerCount,
    totalInvestment,
    likerRewardPool,
    profitableCount,
    profitablePercent: (profitableCount / likerCount) * 100,
    allProfits,
    firstLikerProfit,
  };
}

// ========== 开始完整分析 ==========
console.log("BloomSocial 完整经济模型分析");

// ========== 第一步：验证原始方案的问题 ==========
console.log("\n");
console.log("▶ 第一步：验证原始方案 (70-25-5) 的问题");
console.log("在不同规模的点赞下，第一个用户是否亏损？\n");
const testSizes = [5, 10, 20, 30, 50, 100];
const originalResults = [];

console.log("点赞规模 | 第1人利润 | 获利人数 | 是否全部亏损");
console.log("-".repeat(50));
for (const size of testSizes) {
  const result = analyzeRatio(7000, 2500, 500, size);
  const isAllLoss = result.allProfits.every((p) => p < 0);

  originalResults.push(result);

  const status = isAllLoss ? "是" : "否";
  console.log(
    `${size}人`.padEnd(8) +
      `|${result.firstLikerProfit.toFixed(2)}`.padEnd(12) +
      `|${result.profitableCount}`.padEnd(11) +
      `|${status}`
  );
}

// ========== 第二步：寻找最优比例 ==========
console.log("\n▶ 第二步：探索不同比例，找出最优方案");
console.log("目标：找到能让前 10% 左右的用户获利的比例\n");

// 测试多个比例组合
const testRatios = [
  { author: 7000, liker: 2500, protocol: 500, name: "70-25-5" },
  { author: 6500, liker: 3000, protocol: 500, name: "65-30-5" },
  { author: 6000, liker: 3500, protocol: 500, name: "60-35-5" },
  { author: 5500, liker: 4000, protocol: 500, name: "55-40-5" },
  { author: 5000, liker: 4500, protocol: 500, name: "50-45-5" },
  { author: 4500, liker: 5000, protocol: 500, name: "45-50-5" },
  { author: 4000, liker: 5500, protocol: 500, name: "40-55-5" },
  { author: 3500, liker: 6000, protocol: 500, name: "35-60-5" },
  { author: 3000, liker: 6500, protocol: 500, name: "30-65-5" },
];

// 测试规模
const testScales = [5, 10, 20, 30, 40, 50, 100];

// 存储所有结果用于后续分析
const ratioResults: Array<{
  name: string;
  ratio: { author: number; liker: number; protocol: number };
  scaleResults: Map<number, AnalysisResult>;
  avgProfitRatio: number;
}> = [];

// 对每个比例进行跨规模测试
console.log("在多个规模下测试各种比例的表现：\n");

for (const ratio of testRatios) {
  console.log(`\n【${ratio.name}】`);
  console.log("规模  | 获利人数 | 获利率  | 首位利润 | 达到10%?");
  console.log("-".repeat(58));
  
  const scaleResults = new Map<number, AnalysisResult>();
  let totalProfitRatio = 0;
  let reachedTargetCount = 0;
  
  for (const scale of testScales) {
    const result = analyzeRatio(ratio.author, ratio.liker, ratio.protocol, scale);
    scaleResults.set(scale, result);
    
    const reachedTarget = result.profitablePercent >= 10;
    const status = reachedTarget ? "✅ 是" : "❌ 否";
    
    totalProfitRatio += result.profitablePercent;
    if (reachedTarget) reachedTargetCount++;
    
    console.log(
      `${String(scale).padEnd(6)}|${String(result.profitableCount).padEnd(9)}|${result.profitablePercent.toFixed(1).padEnd(9)}|${result.firstLikerProfit.toFixed(1).padEnd(9)}|${status}`
    );
  }
  
  const avgProfitRatio = totalProfitRatio / testScales.length;
  
  ratioResults.push({
    name: ratio.name,
    ratio,
    scaleResults,
    avgProfitRatio,
  });
}