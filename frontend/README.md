# Datalysis Frontend

The **Datalysis Frontend** is a modern Single Page Application (SPA) built with **React 19**, **TypeScript**, **Vite**, and **Tailwind CSS**. It implements a high-density, **minimalist AMOLED glassmorphic** user experience inspired by Linear, Vercel, and modern developer tooling.

---

## 🎨 Design Philosophy: Anti-AI-Slop & AMOLED Glass

- **Pitch-Black Base (`#000000`)**: Deep black AMOLED canvas with a subtle 24px micro-grid dot texture.
- **Precision Glass Panels**: Ultra-subtle frosted glass cards (`rgba(14, 14, 18, 0.65)`, `backdrop-blur-xl`, `border-white/[0.08]`) with interior hairline bevels.
- **Monochrome-First Typography**: Crisp white (`#FFFFFF`) headings, titanium silver metadata, and monospaced figures. Zero gratuitous purple-cyan rainbow gradients.
- **Functional Status Accents**: Color is reserved purely for state diagnostics (emerald for healthy, amber for warnings, rose for pruning and outliers).

---

## 📂 Component Directory

```
src/
├── components/
│   ├── Navbar.tsx              # Sticky header with official emblem, dataset stats, and tab router
│   ├── UploadZone.tsx          # Drag-and-drop file upload with format chips and 1-click sample loaders
│   ├── HealthScoreCard.tsx     # Circular health index gauge, grade badge, and sub-score progress bars
│   ├── ReasoningTrace.tsx      # Terminal-style audit log displaying the expert engine's inference stream
│   ├── DataVisualizer.tsx      # Multi-view interactive vector visualizer (Histograms, Scatter, Grouped, Matrix)
│   ├── RecommendationsTable.tsx# High-density column recipes table with "Inspect" diagnostic modal
│   ├── OutlierDistribution.tsx # Frequency histograms with Tukey 1.5x IQR boundaries and quartiles
│   ├── CorrelationMatrix.tsx   # Collinearity warnings and interactive Pearson heatmap matrix
│   ├── ExpertChat.tsx          # Diagnostic query console for grounded dataset Q&A
│   ├── CodeExport.tsx          # Standalone Scikit-Learn pipeline.py viewer with copy/download
│   └── CleanedDataPreview.tsx  # In-memory transformation executor, diff metrics, and cleaned CSV export
├── services/
│   └── api.ts                  # Typed REST API client
├── types/
│   └── index.ts                # TypeScript interfaces for metadata, facts, rules, and recommendations
├── App.tsx                     # Main dashboard container
└── index.css                   # AMOLED glassmorphism styling and Tailwind base utilities
```

---

## 🛠 Development & Build Commands

```bash
# 1. Install dependencies
npm install

# 2. Start Vite local development server
npm run dev

# 3. Build optimized production bundle into frontend/dist
npm run build

# 4. Preview production build
npm run preview
```

When built, the production bundle (`frontend/dist`) is automatically mounted and served as static files by the FastAPI backend at `http://127.0.0.1:8000/`.
