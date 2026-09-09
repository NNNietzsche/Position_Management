'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CircleDollarSign,
  ClipboardPaste,
  PieChart,
  Scale,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Holding = {
  name: string;
  ticker: string;
  exchange: string;
  quantity: number;
  marketYen: number;
  marketUsd: number;
  pnlYenPct: number;
};
type Category = 'core' | 'defensive' | 'satellite' | 'speculative';

const CATEGORY_META: Record<
  Category | 'cash',
  { label: string; color: string; soft: string }
> = {
  core: { label: '核心长期仓', color: '#547a42', soft: '#edf5d8' },
  defensive: { label: '防守资产', color: '#54798a', soft: '#e8f1f4' },
  satellite: { label: '优质个股仓', color: '#d49a36', soft: '#fff3d8' },
  speculative: { label: '投机仓', color: '#c66052', soft: '#fbe9e5' },
  cash: { label: '现金仓', color: '#87918d', soft: '#edf0ef' },
};

const DEFAULT_CATEGORIES: Record<string, Category> = {
  VOO: 'core',
  QQQM: 'core',
  VHT: 'satellite',
  AMZN: 'satellite',
  AVGO: 'satellite',
  GOOG: 'satellite',
  MSFT: 'satellite',
  NVDA: 'satellite',
  APP: 'speculative',
  INTC: 'speculative',
  CELH: 'speculative',
  STZ: 'speculative',
};

const SAMPLE = `サンプル S&P 500 ETF
VOONYSE Arca
100.00 USD
15,000 円
5
(0)
90.00 USD
13,500 円
450.00 USD
67,500 円
500.00 USD
75,000 円
+11.11 %
+11.11 %

注文
サンプル・テック
DEMONASDAQ
50.00 USD
7,500 円
2
(0)
55.00 USD
8,250 円
110.00 USD
16,500 円
100.00 USD
15,000 円
-9.09 %
-9.09 %

注文
預り金
通貨
保有数量
円換算評価額
米ドル
200.00 USD
30,000 円`;

function numberOf(value: string) {
  return Number(value.replace(/[,+]/g, ''));
}

function parsePortfolio(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const holdings: Holding[] = [];
  const tickerPattern =
    /^([A-Z][A-Z0-9.-]*)(NASDAQ|NYSE(?:\s+Arca)?|NYSE\s+American)$/;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(tickerPattern);
    if (!match) continue;
    const nextTicker = lines
      .slice(index + 1)
      .findIndex((line) => tickerPattern.test(line));
    const end = nextTicker === -1 ? lines.length : index + 1 + nextTicker;
    const segment = lines.slice(index + 1, end);
    const usd = segment
      .filter((line) => /^[-+]?\d[\d,]*(?:\.\d+)?\s*USD$/.test(line))
      .map(numberOf);
    const yen = segment
      .filter((line) => /^[-+]?\d[\d,]*\s*円$/.test(line))
      .map(numberOf);
    const percents = segment
      .filter((line) => /^[-+]?\d+(?:\.\d+)?\s*%$/.test(line))
      .map(numberOf);
    const quantity = segment
      .map((line) => line.match(/^([\d,]+)$/)?.[1])
      .find(Boolean);
    if (usd.length < 4 || yen.length < 4) continue;
    holdings.push({
      name: lines[index - 1],
      ticker: match[1],
      exchange: match[2],
      quantity: quantity ? numberOf(quantity) : 0,
      marketUsd: usd[3],
      marketYen: yen[3],
      pnlYenPct: percents[1] ?? 0,
    });
  }
  const cashStart = lines.findIndex((line) => line === '預り金');
  const cashLines = cashStart >= 0 ? lines.slice(cashStart) : [];
  const cashYen = cashLines
    .map((line) => line.match(/^([\d,]+)\s*円$/)?.[1])
    .find(Boolean);
  const cashUsd = cashLines
    .map((line) => line.match(/^([\d,]+(?:\.\d+)?)\s*USD$/)?.[1])
    .find(Boolean);
  return {
    holdings,
    cashYen: cashYen ? numberOf(cashYen) : 0,
    cashUsd: cashUsd ? numberOf(cashUsd) : 0,
  };
}

const yen = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
});

export default function Home() {
  const [raw, setRaw] = useState(SAMPLE);
  const [categories, setCategories] =
    useState<Record<string, Category>>(DEFAULT_CATEGORIES);
  const [targets, setTargets] = useState<Record<Category | 'cash', number>>({
    core: 55,
    defensive: 15,
    satellite: 15,
    speculative: 5,
    cash: 10,
  });
  const portfolio = useMemo(() => parsePortfolio(raw), [raw]);
  const invested = portfolio.holdings.reduce(
    (sum, item) => sum + item.marketYen,
    0,
  );
  const total = invested + portfolio.cashYen;
  const allocation = useMemo(() => {
    const result: Record<Category | 'cash', number> = {
      core: 0,
      defensive: 0,
      satellite: 0,
      speculative: 0,
      cash: portfolio.cashYen,
    };
    portfolio.holdings.forEach((item) => {
      result[categories[item.ticker] ?? 'satellite'] += item.marketYen;
    });
    return result;
  }, [portfolio, categories]);
  const categoryKeys = Object.keys(CATEGORY_META) as (Category | 'cash')[];
  const targetTotal = categoryKeys.reduce((sum, key) => sum + targets[key], 0);
  const segments = categoryKeys.map((key) => ({
    key,
    pct: total ? (allocation[key] / total) * 100 : 0,
  }));
  let cursor = 0;
  const gradient = segments
    .map(({ key, pct }) => {
      const start = cursor;
      cursor += pct;
      return `${CATEGORY_META[key].color} ${start}% ${cursor}%`;
    })
    .join(', ');
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/8 bg-[#102723] text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#d7ff77] text-[#102723]">
              <PieChart size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-wide">
                PORTFOLIO COMPASS
              </p>
              <p className="text-xs text-white/55">持仓配置仪表盘</p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
            数据仅在浏览器中处理
          </span>
        </div>
      </header>
      <section className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-[#557269]">
              Allocation workspace
            </p>
            <h1 className="text-3xl font-semibold tracking-[-.04em] sm:text-4xl">
              把券商文本，变成可执行的仓位计划
            </h1>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            粘贴日文持仓明细，即时计算日元权重与集中度。
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: '组合总额',
              value: yen.format(total),
              detail: `${portfolio.holdings.length} 只证券`,
              icon: WalletCards,
            },
            {
              label: '已投资产',
              value: yen.format(invested),
              detail: total ? `${((invested / total) * 100).toFixed(1)}%` : '—',
              icon: PieChart,
            },
            {
              label: '美元现金',
              value: yen.format(portfolio.cashYen),
              detail: total
                ? `${((portfolio.cashYen / total) * 100).toFixed(1)}% · $${portfolio.cashUsd.toLocaleString()}`
                : '—',
              icon: CircleDollarSign,
            },
          ].map((item) => (
            <article
              key={item.label}
              className="rounded-2xl border bg-card p-5 shadow-[0_1px_0_rgba(16,39,35,.05)]"
            >
              <div className="mb-5 flex items-center justify-between text-muted-foreground">
                <span className="text-sm">{item.label}</span>
                <item.icon size={18} />
              </div>
              <p className="text-2xl font-semibold tracking-tight">
                {item.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.detail}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="rounded-2xl border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">导入券商文本</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  支持 NASDAQ / NYSE / NYSE Arca
                </p>
              </div>
              <ClipboardPaste className="text-[#557269]" size={19} />
            </div>
            <Textarea
              aria-label="券商持仓文本"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              className="h-[430px] resize-none bg-[#f6f7f2] font-mono text-xs leading-5"
            />
            <Button
              className="mt-3 w-full bg-[#102723] text-white hover:bg-[#173a34]"
              onClick={() => setRaw(SAMPLE)}
            >
              恢复示例数据
            </Button>
          </aside>
          <section className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="font-semibold">持仓权重</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  按日元评价额计算·分类可修改
                </p>
              </div>
              <span className="rounded-full bg-[#edf5d8] px-3 py-1 text-xs font-medium text-[#355026]">
                已识别 {portfolio.holdings.length} 项
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-[#f6f7f2] text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">标的</th>
                    <th className="px-4 py-3 font-medium">分类</th>
                    <th className="px-4 py-3 text-right font-medium">
                      日元评价
                    </th>
                    <th className="px-4 py-3 text-right font-medium">权重</th>
                    <th className="px-4 py-3 text-right font-medium">
                      日元损益
                    </th>
                    <th className="px-5 py-3 text-right font-medium">
                      仓位信号
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.holdings
                    .sort((a, b) => b.marketYen - a.marketYen)
                    .map((item) => {
                      const weight = total ? (item.marketYen / total) * 100 : 0;
                      const category = categories[item.ticker] ?? 'satellite';
                      const overCap = category !== 'core' && weight > 5;
                      return (
                        <tr key={item.ticker} className="border-t">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <span className="grid size-9 place-items-center rounded-xl bg-[#edf1ed] text-xs font-bold text-[#24443d]">
                                {item.ticker.slice(0, 2)}
                              </span>
                              <div>
                                <p className="font-semibold">
                                  {item.ticker}{' '}
                                  <span className="ml-1 font-normal text-muted-foreground">
                                    × {item.quantity}
                                  </span>
                                </p>
                                <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                                  {item.name}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              aria-label={`${item.ticker} 分类`}
                              value={category}
                              onChange={(event) =>
                                setCategories((current) => ({
                                  ...current,
                                  [item.ticker]: event.target.value as Category,
                                }))
                              }
                              className="max-w-[145px] rounded-lg border bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#8faf52]"
                            >
                              <option value="core">核心长期仓</option>
                              <option value="defensive">防守资产</option>
                              <option value="satellite">优质个股仓</option>
                              <option value="speculative">投机仓</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            {yen.format(item.marketYen)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-semibold tabular-nums">
                              {weight.toFixed(1)}%
                            </p>
                            <div className="ml-auto mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-[#e8ebe5]">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${Math.min(weight * 4, 100)}%`,
                                  background: CATEGORY_META[category].color,
                                }}
                              />
                            </div>
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-medium tabular-nums ${item.pnlYenPct >= 0 ? 'text-[#32755d]' : 'text-[#b45448]'}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {item.pnlYenPct >= 0 ? (
                                <ArrowUp size={13} />
                              ) : (
                                <ArrowDown size={13} />
                              )}
                              {Math.abs(item.pnlYenPct).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${overCap ? 'bg-[#fbe9e5] text-[#a6463a]' : 'bg-[#edf0ef] text-[#586460]'}`}
                            >
                              {overCap ? '减至 5% 以内' : '保持 / 按类别调整'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.35fr]">
          <article className="rounded-2xl border bg-card p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">当前仓位结构</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  现金同样计入组合总权重
                </p>
              </div>
              <PieChart size={19} className="text-[#557269]" />
            </div>
            <div className="grid items-center gap-6 sm:grid-cols-[170px_1fr]">
              <div
                className="relative mx-auto size-[170px] rounded-full"
                style={{ background: `conic-gradient(${gradient})` }}
              >
                <div className="absolute inset-7 grid place-items-center rounded-full bg-card text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">总资产</p>
                    <p className="mt-1 text-lg font-semibold">
                      {(total / 10000).toFixed(1)}万
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {categoryKeys.map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <i
                        className="size-2.5 rounded-full"
                        style={{ background: CATEGORY_META[key].color }}
                      />
                      {CATEGORY_META[key].label}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {total
                        ? ((allocation[key] / total) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">目标配置与调仓缺口</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  直接修改目标；差额按当前总资产计算
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${targetTotal === 100 ? 'bg-[#edf5d8] text-[#355026]' : 'bg-[#fbe9e5] text-[#a6463a]'}`}
              >
                目标合计 {targetTotal}%
              </span>
            </div>
            <div className="space-y-2">
              {categoryKeys.map((key) => {
                const currentPct = total ? (allocation[key] / total) * 100 : 0;
                const gap = (total * targets[key]) / 100 - allocation[key];
                return (
                  <div
                    key={key}
                    className="grid grid-cols-[minmax(120px,1fr)_90px_92px] items-center gap-3 rounded-xl bg-[#f6f7f2] px-3 py-3 sm:grid-cols-[1.2fr_110px_110px_130px]"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {CATEGORY_META[key].label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        当前 {currentPct.toFixed(1)}%
                      </p>
                    </div>
                    <label className="flex items-center rounded-lg border bg-white px-2">
                      <input
                        aria-label={`${CATEGORY_META[key].label}目标`}
                        type="number"
                        min="0"
                        max="100"
                        value={targets[key]}
                        onChange={(event) =>
                          setTargets((current) => ({
                            ...current,
                            [key]: Math.max(0, Number(event.target.value)),
                          }))
                        }
                        className="w-full bg-transparent py-1.5 text-right text-sm font-semibold outline-none"
                      />
                      <span className="ml-1 text-xs text-muted-foreground">
                        %
                      </span>
                    </label>
                    <div
                      className={`text-right text-sm font-semibold tabular-nums ${gap > 500 ? 'text-[#32755d]' : gap < -500 ? 'text-[#b45448]' : 'text-muted-foreground'}`}
                    >
                      {gap > 500 ? '+' : ''}
                      {yen.format(Math.round(gap))}
                    </div>
                    <span
                      className={`hidden justify-self-end rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex ${gap > total * 0.015 ? 'bg-[#edf5d8] text-[#355026]' : gap < -total * 0.015 ? 'bg-[#fbe9e5] text-[#a6463a]' : 'bg-[#edf0ef] text-[#586460]'}`}
                    >
                      {gap > total * 0.015
                        ? '建议增持'
                        : gap < -total * 0.015
                          ? '建议减持'
                          : '接近目标'}
                    </span>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-[#efd2cb] bg-[#fff9f7] p-5">
            <div className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fbe9e5] text-[#a6463a]">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h3 className="font-semibold">集中度预警</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {portfolio.holdings.filter(
                    (item) => total && item.marketYen / total > 0.05,
                  ).length
                    ? `${portfolio.holdings
                        .filter((item) => item.marketYen / total > 0.05)
                        .map((item) => item.ticker)
                        .join(
                          '、',
                        )} 已超过单只 5% 的风险上限。宽基 ETF 可按核心仓规则另行管理。`
                    : '当前没有单只证券超过 5%。'}
                </p>
              </div>
            </div>
          </article>
          <article className="rounded-2xl border border-[#d6e0ca] bg-[#f9fcf2] p-5">
            <div className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf5d8] text-[#547a42]">
                <Scale size={18} />
              </span>
              <div>
                <h3 className="font-semibold">执行顺序</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  先用现金和新增资金补足缺口最大的类别，再分批处理超配仓位。只在类别偏离目标超过
                  5 个百分点时调仓。
                </p>
              </div>
            </div>
          </article>
        </section>
        <p className="py-7 text-center text-xs leading-5 text-muted-foreground">
          本工具只做数据整理与仓位规划，不构成个股买卖建议。券商文本不会上传到服务器。
        </p>
      </section>
    </main>
  );
}
