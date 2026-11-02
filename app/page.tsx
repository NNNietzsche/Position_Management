'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CircleDollarSign,
  ClipboardPaste,
  PieChart,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

type Holding = {
  name: string;
  ticker: string;
  exchange: string;
  accounts: string[];
  quantity: number;
  marketYen: number;
  marketUsd: number;
  pnlPct: number;
};
type Category = 'core' | 'satellite' | 'speculative';
type SortBy = 'weight' | 'return' | 'category';

const CATEGORY_META: Record<
  Category | 'cash',
  { label: string; color: string; soft: string }
> = {
  core: { label: '核心长期仓', color: '#547a42', soft: '#edf5d8' },
  satellite: {
    label: '卫星仓（优质个股/行业ETF）',
    color: '#d49a36',
    soft: '#fff3d8',
  },
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
  SOXL: 'speculative',
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
  return Number(value.replace(/[,+]/g, '').replace(/\s*(?:USD|円|%)\s*$/, ''));
}

function parseDetailedPortfolio(lines: string[]) {
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
      accounts: [],
      quantity: quantity ? numberOf(quantity) : 0,
      marketUsd: usd[3],
      marketYen: yen[3],
      pnlPct: percents[1] ?? 0,
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

function parseCompactPortfolio(lines: string[]) {
  const rows: (Holding & { pnlUsd: number })[] = [];
  let account = '';
  const accountPattern = /^米国株式\(現物\/(一般預り|NISA預り)\)$/;
  const matchSecurity = (line: string) => {
    for (let split = 1; split <= Math.min(6, line.length - 1); split += 1) {
      const ticker = line.slice(0, split);
      const name = line.slice(split);
      if (
        /^[A-Z][A-Z0-9.-]*$/.test(ticker) &&
        (/^[^\x00-\x7F]/.test(name) || /^[A-Z][a-z]/.test(name))
      ) {
        return { ticker, name };
      }
    }
    return null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const accountMatch = lines[index].match(accountPattern);
    if (accountMatch) {
      account = accountMatch[1] === 'NISA預り' ? 'NISA' : '一般';
      continue;
    }
    const securityMatch = matchSecurity(lines[index]);
    if (!account || !securityMatch) continue;

    const numbers: number[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (accountPattern.test(lines[cursor]) || matchSecurity(lines[cursor]))
        break;
      if (/^[-+]?\d[\d,]*(?:\.\d+)?$/.test(lines[cursor])) {
        numbers.push(numberOf(lines[cursor]));
      }
    }
    if (numbers.length < 4) continue;
    const [quantity, averagePrice, currentPrice, pnlUsd] = numbers;
    const cost = quantity * averagePrice;
    rows.push({
      name: securityMatch.name,
      ticker: securityMatch.ticker,
      exchange: '',
      accounts: [account],
      quantity,
      marketYen: 0,
      marketUsd: quantity * currentPrice,
      pnlUsd,
      pnlPct: cost ? (pnlUsd / cost) * 100 : 0,
    });
  }

  const merged = new Map<string, Holding & { pnlUsd: number }>();
  rows.forEach((row) => {
    const current = merged.get(row.ticker);
    if (!current) {
      merged.set(row.ticker, { ...row });
      return;
    }
    const combinedPnl = current.pnlUsd + row.pnlUsd;
    const combinedMarket = current.marketUsd + row.marketUsd;
    const combinedCost = combinedMarket - combinedPnl;
    merged.set(row.ticker, {
      ...current,
      accounts: Array.from(new Set([...current.accounts, ...row.accounts])),
      quantity: current.quantity + row.quantity,
      marketUsd: combinedMarket,
      pnlUsd: combinedPnl,
      pnlPct: combinedCost ? (combinedPnl / combinedCost) * 100 : 0,
    });
  });
  return Array.from(merged.values());
}

function parsePortfolio(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const detailed = parseDetailedPortfolio(lines);
  if (detailed.holdings.length) {
    return { ...detailed, currency: 'JPY' as const };
  }
  return {
    holdings: parseCompactPortfolio(lines),
    cashYen: 0,
    cashUsd: 0,
    currency: 'USD' as const,
  };
}

const yen = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
});
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

function riskTags(item: Holding, category: Category, weight: number) {
  const tags: { label: string; tone: 'profit' | 'loss' | 'rebalance' }[] = [];

  if (category === 'satellite') {
    if (item.pnlPct <= -20) {
      tags.push({ label: '止损复核：跌幅≥20%', tone: 'loss' });
    }
    if (weight > 5) {
      tags.push({
        label: '再平衡：仓位超过5%，减至3%–4%',
        tone: 'rebalance',
      });
      if (item.pnlPct > 0) {
        tags.push({ label: '止盈：兑现超额仓位', tone: 'profit' });
      }
    }
  }

  if (category === 'speculative') {
    if (item.pnlPct <= -8) {
      tags.push({ label: '止损：进入8%–12%区间', tone: 'loss' });
    } else if (item.pnlPct >= 40) {
      tags.push({ label: '二次止盈：再卖1/3', tone: 'profit' });
    } else if (item.pnlPct >= 20) {
      tags.push({ label: '首次止盈：卖1/3', tone: 'profit' });
    }
    if (weight > 2) {
      tags.push({
        label: '再平衡：投机仓单标的超过2%',
        tone: 'rebalance',
      });
    }
  }

  return tags;
}

export default function Home() {
  const [raw, setRaw] = useState(SAMPLE);
  const [manualCash, setManualCash] = useState('');
  const [categories, setCategories] =
    useState<Record<string, Category>>(DEFAULT_CATEGORIES);
  const [sortBy, setSortBy] = useState<SortBy>('weight');
  const [targets, setTargets] = useState<Record<Category | 'cash', number>>({
    core: 55,
    satellite: 30,
    speculative: 5,
    cash: 10,
  });
  const portfolio = useMemo(() => parsePortfolio(raw), [raw]);
  const positionValue = (item: Holding) =>
    portfolio.currency === 'JPY' ? item.marketYen : item.marketUsd;
  const importedCashValue =
    portfolio.currency === 'JPY' ? portfolio.cashYen : portfolio.cashUsd;
  const hasManualCash = manualCash.trim() !== '';
  const cashValue = hasManualCash
    ? Math.max(0, Number(manualCash.replace(/[,\s]/g, '')) || 0)
    : importedCashValue;
  const formatMoney = (value: number) =>
    portfolio.currency === 'JPY' ? yen.format(value) : usd.format(value);
  const invested = portfolio.holdings.reduce(
    (sum, item) => sum + positionValue(item),
    0,
  );
  const total = invested + cashValue;
  const allocation = useMemo(() => {
    const result: Record<Category | 'cash', number> = {
      core: 0,
      satellite: 0,
      speculative: 0,
      cash: cashValue,
    };
    portfolio.holdings.forEach((item) => {
      result[categories[item.ticker] ?? 'satellite'] += positionValue(item);
    });
    return result;
  }, [portfolio, categories, cashValue]);
  const categoryKeys = Object.keys(CATEGORY_META) as (Category | 'cash')[];
  const categoryOrder: Category[] = ['core', 'satellite', 'speculative'];
  const sortedHoldings = [...portfolio.holdings].sort((a, b) => {
    if (sortBy === 'return') return b.pnlPct - a.pnlPct;
    if (sortBy === 'category') {
      const categoryDifference =
        categoryOrder.indexOf(categories[a.ticker] ?? 'satellite') -
        categoryOrder.indexOf(categories[b.ticker] ?? 'satellite');
      return categoryDifference || positionValue(b) - positionValue(a);
    }
    return positionValue(b) - positionValue(a);
  });
  const targetTotal = categoryKeys.reduce((sum, key) => sum + targets[key], 0);
  const targetsAreValid = Math.abs(targetTotal - 100) < 0.01;
  const cashPct = total ? (cashValue / total) * 100 : 0;
  const cashGapPct = targets.cash - cashPct;
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
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-5 py-4 lg:px-8">
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
      <section className="mx-auto max-w-[1800px] px-5 py-7 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-[#557269]">
              Allocation workspace
            </p>

          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            粘贴日文持仓明细，即时计算权重与集中度。
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: '组合总额',
              value: formatMoney(total),
              detail: `${portfolio.holdings.length} 只证券`,
              icon: WalletCards,
            },
            {
              label: '已投资产',
              value: formatMoney(invested),
              detail: total ? `${((invested / total) * 100).toFixed(1)}%` : '—',
              icon: PieChart,
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
          <article className="rounded-2xl border bg-card p-5 shadow-[0_1px_0_rgba(16,39,35,.05)]">
            <div className="mb-3 flex items-center justify-between text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">现金仓</span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${!targetsAreValid ? 'bg-[#fff0cf] text-[#906414]' : cashGapPct > 1.5 ? 'bg-[#edf5d8] text-[#355026]' : cashGapPct < -1.5 ? 'bg-[#fbe9e5] text-[#a6463a]' : 'bg-[#edf0ef] text-[#586460]'}`}
                >
                  {!targetsAreValid
                    ? '等待目标合计100%'
                    : cashGapPct > 1.5
                      ? `建议增持现金 ${cashGapPct.toFixed(1)}个百分点`
                      : cashGapPct < -1.5
                        ? `建议减持现金 ${Math.abs(cashGapPct).toFixed(1)}个百分点`
                        : '现金接近目标'}
                </span>
              </div>
              <CircleDollarSign size={18} />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  {formatMoney(cashValue)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {total ? `${cashPct.toFixed(1)}%` : '—'}
                  {hasManualCash
                    ? ' · 使用手动输入'
                    : portfolio.currency === 'JPY' && portfolio.cashUsd
                      ? ` · 券商读取 $${portfolio.cashUsd.toLocaleString()}`
                      : ' · 使用券商读取值'}
                </p>
              </div>
              {hasManualCash && (
                <button
                  type="button"
                  onClick={() => setManualCash('')}
                  className="shrink-0 text-xs font-medium text-[#557269] underline-offset-4 hover:underline"
                >
                  恢复读取值
                </button>
              )}
            </div>
            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              手动输入现金（{portfolio.currency}）
              <input
                aria-label={`手动输入现金（${portfolio.currency}）`}
                inputMode="decimal"
                value={manualCash}
                onChange={(event) => setManualCash(event.target.value)}
                placeholder={`留空则使用券商读取值 ${formatMoney(importedCashValue)}`}
                className="mt-1.5 w-full rounded-lg border bg-[#f6f7f2] px-3 py-2 text-sm font-medium tabular-nums text-foreground outline-none placeholder:text-xs placeholder:font-normal focus:ring-2 focus:ring-[#8faf52]"
              />
            </label>
          </article>
        </div>
        <div className="mt-5">
          <section className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="font-semibold">持仓权重</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  按{portfolio.currency === 'JPY' ? '日元' : '美元'}
                  评价额计算·分类可修改
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Sheet>
                  <SheetTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-white"
                      />
                    }
                  >
                    <ClipboardPaste size={15} />
                    导入券商文本
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="!w-[min(92vw,640px)] !max-w-[640px] gap-0 bg-[#fffefb]"
                  >
                    <SheetHeader className="border-b px-6 py-5">
                      <SheetTitle className="text-lg">导入券商文本</SheetTitle>
                      <SheetDescription>
                        粘贴详细格式，或一般 / NISA
                        简表格式。内容只在浏览器中处理。
                      </SheetDescription>
                    </SheetHeader>
                    <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
                      <Textarea
                        aria-label="券商持仓文本"
                        value={raw}
                        onChange={(event) => setRaw(event.target.value)}
                        className="min-h-[55vh] flex-1 resize-none bg-[#f6f7f2] font-mono text-xs leading-5"
                      />
                      <p className="mt-3 text-xs text-muted-foreground">
                        已识别 {portfolio.holdings.length}{' '}
                        项持仓，修改文本后会立即重新计算。
                      </p>
                    </div>
                    <SheetFooter className="flex-row border-t px-6 py-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setRaw(SAMPLE)}
                      >
                        恢复示例数据
                      </Button>
                      <SheetClose
                        render={
                          <Button className="flex-1 bg-[#102723] text-white hover:bg-[#173a34]" />
                        }
                      >
                        完成导入
                      </SheetClose>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
                <label
                  htmlFor="holding-sort"
                  className="text-xs text-muted-foreground"
                >
                  排序
                </label>
                <select
                  id="holding-sort"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortBy)}
                  className="rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-[#8faf52]"
                >
                  <option value="weight">按权重</option>
                  <option value="return">按收益率</option>
                  <option value="category">按类型</option>
                </select>
                <span className="rounded-full bg-[#edf5d8] px-3 py-1 text-xs font-medium text-[#355026]">
                  已识别 {portfolio.holdings.length} 项
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] text-sm">
                <thead className="bg-[#f6f7f2] text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">标的</th>
                    <th className="px-4 py-3 font-medium">分类</th>
                    <th className="px-4 py-3 text-right font-medium">
                      {portfolio.currency === 'JPY' ? '日元' : '美元'}评价
                    </th>
                    <th className="px-4 py-3 text-right font-medium">权重</th>
                    <th className="px-4 py-3 text-right font-medium">
                      {portfolio.currency === 'JPY' ? '日元' : '外币'}损益
                    </th>
                    <th className="px-5 py-3 text-right font-medium">
                      类型总仓位信号
                    </th>
                    <th className="px-5 py-3 text-right font-medium">
                      风控标签
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map((item) => {
                    const itemValue = positionValue(item);
                    const weight = total ? (itemValue / total) * 100 : 0;
                    const category = categories[item.ticker] ?? 'satellite';
                    const categoryPct = total
                      ? (allocation[category] / total) * 100
                      : 0;
                    const categoryGapPct = targets[category] - categoryPct;
                    const tags = riskTags(item, category, weight);
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
                              <p className="max-w-[280px] whitespace-normal text-xs leading-5 text-muted-foreground">
                                {item.name}
                              </p>
                              {item.accounts.length > 0 && (
                                <p className="mt-0.5 text-[10px] font-medium text-[#557269]">
                                  {item.accounts.join(' + ')}
                                </p>
                              )}
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
                            className="w-[200px] rounded-lg border bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#8faf52]"
                          >
                            <option value="core">核心长期仓</option>
                            <option value="satellite">
                              卫星仓（优质个股/行业ETF）
                            </option>
                            <option value="speculative">投机仓</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatMoney(itemValue)}
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
                          className={`px-4 py-3 text-right font-medium tabular-nums ${item.pnlPct >= 0 ? 'text-[#32755d]' : 'text-[#b45448]'}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {item.pnlPct >= 0 ? (
                              <ArrowUp size={13} />
                            ) : (
                              <ArrowDown size={13} />
                            )}
                            {Math.abs(item.pnlPct).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${!targetsAreValid ? 'bg-[#fff0cf] text-[#906414]' : categoryGapPct > 1.5 ? 'bg-[#edf5d8] text-[#355026]' : categoryGapPct < -1.5 ? 'bg-[#fbe9e5] text-[#a6463a]' : 'bg-[#edf0ef] text-[#586460]'}`}
                          >
                            {!targetsAreValid
                              ? '请先将目标合计调整为100%'
                              : categoryGapPct > 1.5
                                ? `该类型：增持 ${categoryGapPct.toFixed(1)} 个百分点`
                                : categoryGapPct < -1.5
                                  ? `该类型：减持 ${Math.abs(categoryGapPct).toFixed(1)} 个百分点`
                                  : '该类型：接近目标'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {tags.length ? (
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {tags.map((tag) => (
                                <span
                                  key={tag.label}
                                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    tag.tone === 'profit'
                                      ? 'bg-[#e4f3e9] text-[#287052]'
                                      : tag.tone === 'loss'
                                        ? 'bg-[#fbe4e0] text-[#ad473a]'
                                        : 'bg-[#e8f1f4] text-[#3f6878]'
                                  }`}
                                >
                                  {tag.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t bg-[#fafbf7] px-5 py-3 text-[11px] leading-5 text-muted-foreground">
              决策规则：目标配置只驱动“类型总仓位信号”和调仓缺口；风控标签按单标的规则独立判断。红色为止损，绿色为止盈，蓝色为再平衡。卫星仓下跌20%触发止损复核；单一标的超过5%时标记再平衡，如已有盈利则另行标记止盈。投机仓单标的超过2%归类为再平衡；下跌8%进入止损区间，盈利20%
              / 40%分别触发第一次 / 第二次止盈。核心ETF不设机械价格止损。
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
                  四仓模型：核心55% / 卫星30% / 投机5% / 现金10%
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${targetsAreValid ? 'bg-[#edf5d8] text-[#355026]' : 'bg-[#fbe9e5] text-[#a6463a]'}`}
              >
                目标合计 {targetTotal}%
              </span>
            </div>
            <div className="space-y-2">
              {categoryKeys.map((key) => {
                const currentPct = total ? (allocation[key] / total) * 100 : 0;
                const gapPct = targets[key] - currentPct;
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
                      className={`text-right tabular-nums ${gapPct > 0.1 ? 'text-[#32755d]' : gapPct < -0.1 ? 'text-[#b45448]' : 'text-muted-foreground'}`}
                    >
                      <p className="text-sm font-semibold">
                        {gap > 0 ? '+' : ''}
                        {formatMoney(Math.round(gap))}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium">
                        {gapPct > 0 ? '+' : ''}
                        {gapPct.toFixed(1)} 个百分点
                      </p>
                    </div>
                    <span
                      className={`hidden justify-self-end rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex ${!targetsAreValid ? 'bg-[#fff0cf] text-[#906414]' : gap > total * 0.015 ? 'bg-[#edf5d8] text-[#355026]' : gap < -total * 0.015 ? 'bg-[#fbe9e5] text-[#a6463a]' : 'bg-[#edf0ef] text-[#586460]'}`}
                    >
                      {!targetsAreValid
                        ? '等待合计100%'
                        : gap > total * 0.015
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
        <p className="py-7 text-center text-xs leading-5 text-muted-foreground">
          本工具只做数据整理与仓位规划，不构成个股买卖建议。券商文本不会上传到服务器。
        </p>
      </section>
    </main>
  );
}
