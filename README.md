![截屏2026-09-11 16 01 08](https://github.com/user-attachments/assets/4a3691c6-30ef-42bf-9f92-aa1e15831e23)# Portfolio Compass

一个本地运行的美股持仓分析工具。可自动计算持仓权重、分类仓位、调仓缺口及风险标签。

## 主要功能

- 识别日本券商的美股持仓文本
- 合并一般账户与 NISA 账户的同一标的
- 按权重、收益率或仓位类型排序
- 手动修改美元现价
- 手动添加和删除持仓
- 手动输入现金仓金额
- 自动计算总资产、持仓权重和调仓比例
- 显示止盈、止损及再平衡标签
- 所有数据仅在浏览器中处理



<img 
  src="https://github.com/user-attachments/assets/c54f3d6c-6da4-4e9b-9201-715f5c2cea2c" 
  alt="1" 
  width="800">

  <img 
  src="https://github.com/user-attachments/assets/ea307141-50d3-4720-9ff1-deb42cfabcb2" 
  alt="2" 
  width="800">
  
## 默认仓位模型

| 类型 | 目标比例 |
|---|---:|
| 核心长期仓 | 55% |
| 卫星仓（优质个股/行业 ETF） | 30% |
| 投机仓 | 5% |
| 现金仓 | 10% |

目标比例可以在页面中自行修改，但合计应保持为 100%。

## 启动方法

需要先安装 [Node.js](https://nodejs.org/)。

```bash
cd /Users/dingjiaye/Desktop/股票
npm install
npm run dev
