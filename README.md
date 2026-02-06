# 🚀 CodeSense: A C++ Logic Analysis Mentor

CodeSense is a browser-native, rule-based gamified debugging system designed to assist users in mastering C++ programming logic. Unlike traditional IDEs that focus on machine-code production, CodeSense acts as a logic interpreter and pedagogical analyzer, helping students understand the "why" and "how" of their code through deterministic static analysis and interactive visualizations.

---

## 🛠️ Quick Start Guide

### 1. Prerequisites
Ensure you have the following installed on your machine:
* **Node.js**: v18.0.0 or higher
* **Git**: For cloning the project repository

### 2. Installation
==================================================================================================================================

Clone the repository and navigate to the project folder:
```bash
git clone [https://github.com/arde-eir/codesense-final.git](https://github.com/arde-eir/codesense-final.git)
cd codesense-final
==================================================================================================================================



==================================================================================================================================

3. Running the Backend
The backend handles the PEG.js parser and symbolic execution engine.
==================================================================================================================================
cd backend
npm install
npm run dev
==================================================================================================================================
The logic engine will start on http://localhost:3000.


4. Running the Frontend
The frontend provides the interactive code editor and flow visualizers.
==================================================================================================================================
# Open a new terminal tab
cd frontend
npm install
npm run dev
==================================================================================================================================
The interface will start on http://localhost:5173.



💻 System Requirements
End-User Hardware Requirements
For an optimal experience, the system requires a processor equivalent to an Intel Core i3 (7th Gen), AMD Ryzen 3 3000, or an Apple M1 chip at minimum, though an Intel Core i5 (10th Gen+), AMD Ryzen 5 5000, or Apple M2+ is recommended. While the system can run on 4 GB of RAM, 8 GB to 16 GB is highly recommended to handle complex Flow Graph renderings. Users should have at least 500 MB of available storage space, with 1 GB or more preferred. The interface is best viewed on a display with at least 1366 x 768 resolution, though 1920 x 1080 (Full HD) is recommended for side-by-side views. While integrated graphics will suffice, a dedicated GPU like a GTX 1050 or RX 560+ is recommended for smoother animations.

End-User Software Requirements
CodeSense is supported on Windows 10/11, macOS 11.0 or higher (Big Sur to Sonoma), and Ubuntu 20.04+ Linux distributions. It requires the latest stable version of Google Chrome, Microsoft Edge, or Mozilla Firefox. The system runs on a Node.js v18.0.0 or higher runtime and requires both JavaScript and WebGL 2.0 to be enabled in the browser settings.

🏗️ Developer Build Environment
Development Hardware
Developers modifying the engine should use a high-performance processor like an Intel Core i7, AMD Ryzen 7, or an Apple M-Series chip to handle simultaneous TypeScript compilation and analysis. A minimum of 16 GB of RAM is required to support the TypeScript Language Server and PEG.js parser generation. High-speed storage, such as a 2 GB+ NVMe SSD, is crucial for indexing the extensive dependency folders. A dual-monitor setup with at least 1080p resolution is recommended to keep the code editor and developer tools visible at the same time.

Software Stack
The core system is built on Node.js and TypeScript 5.x, utilizing PEG.js to compile the cpp.pegjs grammar file. The frontend is powered by React 18 and Vite, using ReactFlow for dynamic Flow Graph visualizations. Styling is managed through Tailwind CSS and PostCSS, while the Monaco Editor provides the high-performance coding environment.