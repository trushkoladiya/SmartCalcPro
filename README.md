# ⚡ SmartCalc Pro

A **unique Windows Forms Calculator** built in C# (.NET 6) as part of the .NET Programming Lab (303105352) — Unit 4 Project.

## ✨ What Makes It Different

Unlike a plain basic calculator, **SmartCalc Pro** combines three calculators in one sleek dark-themed app:

|Feature|Description|
|-|-|
|🔢 Standard Calculator|Full arithmetic: +, −, ×, ÷, %|
|🔬 Scientific Calculator|sin, cos, tan (degrees), √, x², log, ln|
|🔄 Unit Converter|°C↔°F, km↔mi, kg↔lb — built right in|

## 🎨 UI Highlights

* **Dark theme** with color-coded button groups
* **Expression history** bar shows the full calculation in real time
* **Mode indicator** shows whether you're in Standard / Scientific / Converter mode
* **Auto font shrink** — long numbers scale down automatically so they always fit
* **Hover \& click animations** on every button

## 📁 Project Structure

```
SmartCalcPro/
├── SmartCalcPro.sln          ← Solution file (open this in Visual Studio)
└── SmartCalcPro/
    ├── SmartCalcPro.csproj   ← Project file (.NET 6 WinForms)
    ├── Program.cs            ← Entry point
    ├── Form1.cs              ← All UI + logic (single-file design)
    └── Form1.Designer.cs     ← Designer partial class
```

## 🚀 How to Run

### Prerequisites

* Visual Studio 2022 (Community or higher)
* .NET 6 SDK with **Windows Forms** workload

### Steps

1. Clone / download and unzip this repo
2. Open `SmartCalcPro.sln` in Visual Studio
3. Press **F5** or click ▶ Run
4. The app launches instantly — no database, no config needed

## 🧮 Supported Operations

### Standard

```
7 + 3 = 10
100 ÷ 4 = 25
5 × 6 = 30
50 % → 0.5
```

### Scientific

```
sin(30°) = 0.5
cos(60°) = 0.5
√(144)   = 12
5²       = 25
log(100) = 2
ln(e)    = 1
```

### Unit Converter (uses current display value)

```
100 °C → °F  = 212
32  °F → °C  = 0
10  km → mi  = 6.21371
70  kg → lb  = 154.324
```

## 📚 Concepts Used (Unit 4 — Windows Forms)

* Windows Forms controls: `Label`, `Button`
* Event handling (`Button.Click`)
* Dynamic property modification at runtime (Font, Color, Text)
* Custom UI painting (flat style, color palette)
* C# pattern matching (`switch` expressions)
* Math library functions (`Math.Sin`, `Math.Sqrt`, etc.)

## 👨‍💻 Developer

**Enrollment No:** 2303031080004  
**Subject:** .NET Programming Lab — 303105352  
**Session:** 2025-26 | Parul University

\---

*Built with ❤️ using C# + Windows Forms*

