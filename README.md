# NEXA Agents — Multi-Agent Business OS

MVP dashboard untuk mensimulasikan orkestrasi multi-agent tanpa bentrokan data.

## Agent
- Orchestrator Agent — dependency & task routing
- Production Agent — owner data produksi
- Inventory Agent — owner stok
- Costing Agent — owner HPP
- Sales Agent — owner penjualan
- Finance Agent — owner jurnal/keuangan
- Dashboard Agent — read-only analytics

## Prinsip anti-conflict
- Single writer per domain
- Event-driven communication
- Dependency chain
- Idempotency key
- Dashboard read-only

## Jalankan
Buka `index.html` atau deploy ke Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FRayen467%2Fbelajar_apk_mobile02&project-name=nexa-agents&repository-name=nexa-agents)

## Demo flow
Production → Inventory → Costing/HPP → Sales → Finance → Dashboard
