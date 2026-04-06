using System;
using System.Drawing;
using System.Windows.Forms;

namespace SmartCalcPro
{
    public partial class Form1 : Form
    {
        // ── state ──────────────────────────────────────────────
        private double firstNumber = 0;
        private double secondNumber = 0;
        private string currentOperator = "";
        private bool isNewEntry = true;
        private bool hasDecimal = false;
        private string expressionHistory = "";

        // ── color palette ──────────────────────────────────────
        private readonly Color BG         = Color.FromArgb(18,  18,  24);
        private readonly Color DISPLAY_BG = Color.FromArgb(10,  10,  16);
        private readonly Color NUM_BTN    = Color.FromArgb(45,  45,  60);
        private readonly Color OP_BTN     = Color.FromArgb(255, 165,  0);
        private readonly Color SCI_BTN    = Color.FromArgb(30,  90, 160);
        private readonly Color CONV_BTN   = Color.FromArgb(40, 130,  80);
        private readonly Color CLR_BTN    = Color.FromArgb(180,  40,  40);
        private readonly Color EQ_BTN     = Color.FromArgb(0,  180, 120);
        private readonly Color TEXT_WHITE = Color.FromArgb(230, 230, 240);
        private readonly Color TEXT_GOLD  = Color.FromArgb(255, 215,   0);

        public Form1()
        {
            InitializeComponent();
            BuildUI();
        }

        // ════════════════════════════════════════════════════════
        //  UI BUILDER
        // ════════════════════════════════════════════════════════
        private void BuildUI()
        {
            // Form
            this.Text = "SmartCalc Pro";
            this.Size = new Size(480, 720);
            this.MinimumSize = new Size(480, 720);
            this.MaximumSize = new Size(480, 720);
            this.BackColor = BG;
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.Font = new Font("Segoe UI", 10f, FontStyle.Regular);
            this.StartPosition = FormStartPosition.CenterScreen;

            int pad = 10;
            int w = 440;          // usable width
            int bw = 96;          // button width
            int bh = 52;          // button height
            int gap = 8;

            // ── Title label ──────────────────────────────────────
            Label lblTitle = new Label
            {
                Text = "⚡ SmartCalc Pro",
                Font = new Font("Segoe UI", 13f, FontStyle.Bold),
                ForeColor = TEXT_GOLD,
                BackColor = Color.Transparent,
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(w, 36),
                Location = new Point(pad, 8)
            };
            this.Controls.Add(lblTitle);

            // ── Expression label (history) ────────────────────────
            Label lblExpr = new Label
            {
                Name = "lblExpr",
                Text = "",
                Font = new Font("Consolas", 10f),
                ForeColor = Color.FromArgb(140, 140, 160),
                BackColor = DISPLAY_BG,
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleRight,
                Size = new Size(w, 28),
                Location = new Point(pad, 48),
                Padding = new Padding(0, 0, 8, 0)
            };
            this.Controls.Add(lblExpr);

            // ── Main display ──────────────────────────────────────
            Label lblDisplay = new Label
            {
                Name = "lblDisplay",
                Text = "0",
                Font = new Font("Consolas", 28f, FontStyle.Bold),
                ForeColor = TEXT_WHITE,
                BackColor = DISPLAY_BG,
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleRight,
                Size = new Size(w, 70),
                Location = new Point(pad, 76),
                Padding = new Padding(0, 0, 10, 0)
            };
            this.Controls.Add(lblDisplay);

            // ── Mode label ────────────────────────────────────────
            Label lblMode = new Label
            {
                Name = "lblMode",
                Text = "● STANDARD",
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = EQ_BTN,
                BackColor = Color.Transparent,
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleLeft,
                Size = new Size(w, 24),
                Location = new Point(pad, 150)
            };
            this.Controls.Add(lblMode);

            int rowStart = 182;

            // ── Row 0: Scientific buttons ─────────────────────────
            string[,] sciRow = {
                { "sin",  "SCI" }, { "cos",  "SCI" }, { "tan",  "SCI" },
                { "√",    "SCI" }, { "x²",   "SCI" }
            };
            for (int c = 0; c < 5; c++)
            {
                Button b = MakeButton(sciRow[c, 0], sciRow[c, 1],
                    pad + c * (bw - 5 + gap), rowStart, bw - 5, 40);
                b.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
                this.Controls.Add(b);
            }

            // ── Row 1: log, ln, %, C, ⌫ ──────────────────────────
            string[] r1 = { "log", "ln", "%", "C", "⌫" };
            string[] r1t = { "SCI", "SCI", "OP", "CLR", "CLR" };
            for (int c = 0; c < 5; c++)
            {
                Button b = MakeButton(r1[c], r1t[c],
                    pad + c * (bw - 5 + gap), rowStart + 48, bw - 5, 40);
                b.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
                this.Controls.Add(b);
            }

            rowStart += 96;

            // ── Rows 2-5: number pad + ops ────────────────────────
            string[,] grid = {
                { "7", "8", "9", "÷" },
                { "4", "5", "6", "×" },
                { "1", "2", "3", "−" },
                { "0", ".", "=", "+" }
            };
            string[,] gridT = {
                { "NUM","NUM","NUM","OP" },
                { "NUM","NUM","NUM","OP" },
                { "NUM","NUM","NUM","OP" },
                { "NUM","DOT","EQ","OP" }
            };

            for (int r = 0; r < 4; r++)
            {
                for (int c = 0; c < 4; c++)
                {
                    int x = pad + c * (bw + gap);
                    int y = rowStart + r * (bh + gap);
                    Button b = MakeButton(grid[r, c], gridT[r, c], x, y, bw, bh);
                    if (grid[r, c] == "0")   b.Width = bw * 2 + gap;
                    if (grid[r, c] == ".")   { b.Location = new Point(pad + 2 * (bw + gap), y); }
                    if (grid[r, c] == "=")   { b.Location = new Point(pad + 3 * (bw + gap) - gap/2, y); b.Width = bw + gap/2; }
                    this.Controls.Add(b);
                }
            }

            rowStart += 4 * (bh + gap) + 8;

            // ── Converter section ─────────────────────────────────
            Label lblConv = new Label
            {
                Text = "🔄 UNIT CONVERTER",
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = CONV_BTN,
                BackColor = Color.Transparent,
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleLeft,
                Size = new Size(w, 22),
                Location = new Point(pad, rowStart)
            };
            this.Controls.Add(lblConv);
            rowStart += 26;

            string[] convBtns = { "°C→°F", "°F→°C", "km→mi", "mi→km", "kg→lb", "lb→kg" };
            for (int c = 0; c < 6; c++)
            {
                Button b = MakeButton(convBtns[c], "CONV",
                    pad + c * (66 + 4), rowStart, 66, 38);
                b.Font = new Font("Segoe UI", 8f, FontStyle.Bold);
                this.Controls.Add(b);
            }
        }

        // ════════════════════════════════════════════════════════
        //  BUTTON FACTORY
        // ════════════════════════════════════════════════════════
        private Button MakeButton(string text, string type, int x, int y, int w, int h)
        {
            Color bg = type switch
            {
                "NUM"  => NUM_BTN,
                "OP"   => OP_BTN,
                "SCI"  => SCI_BTN,
                "CLR"  => CLR_BTN,
                "EQ"   => EQ_BTN,
                "CONV" => CONV_BTN,
                "DOT"  => NUM_BTN,
                _      => NUM_BTN
            };

            Button btn = new Button
            {
                Text = text,
                Size = new Size(w, h),
                Location = new Point(x, y),
                BackColor = bg,
                ForeColor = TEXT_WHITE,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 13f, FontStyle.Bold),
                Cursor = Cursors.Hand,
                Tag = type
            };
            btn.FlatAppearance.BorderColor = Color.FromArgb(70, 70, 90);
            btn.FlatAppearance.BorderSize = 1;
            btn.FlatAppearance.MouseOverBackColor = LightenColor(bg, 30);
            btn.FlatAppearance.MouseDownBackColor = DarkenColor(bg, 20);
            btn.Click += Button_Click;
            return btn;
        }

        private Color LightenColor(Color c, int amt) =>
            Color.FromArgb(Math.Min(255, c.R + amt), Math.Min(255, c.G + amt), Math.Min(255, c.B + amt));
        private Color DarkenColor(Color c, int amt) =>
            Color.FromArgb(Math.Max(0, c.R - amt), Math.Max(0, c.G - amt), Math.Max(0, c.B - amt));

        // ════════════════════════════════════════════════════════
        //  EVENT HANDLER
        // ════════════════════════════════════════════════════════
        private void Button_Click(object sender, EventArgs e)
        {
            Button btn = (Button)sender;
            string val = btn.Text;

            Label disp = (Label)this.Controls["lblDisplay"];
            Label expr = (Label)this.Controls["lblExpr"];

            switch (val)
            {
                // ── Digits ──────────────────────────────────────
                case "0": case "1": case "2": case "3": case "4":
                case "5": case "6": case "7": case "8": case "9":
                    if (isNewEntry || disp.Text == "0")
                    {
                        disp.Text = val;
                        isNewEntry = false;
                    }
                    else disp.Text += val;
                    ShrinkTextIfNeeded(disp);
                    break;

                // ── Decimal ──────────────────────────────────────
                case ".":
                    if (!hasDecimal)
                    {
                        if (isNewEntry) disp.Text = "0.";
                        else disp.Text += ".";
                        hasDecimal = true;
                        isNewEntry = false;
                    }
                    break;

                // ── Operators ────────────────────────────────────
                case "+": case "−": case "×": case "÷":
                    if (!isNewEntry && currentOperator != "")
                        PerformCalc(disp, expr);
                    firstNumber = double.Parse(disp.Text);
                    currentOperator = val;
                    expressionHistory = $"{FormatNum(firstNumber)} {val}";
                    expr.Text = expressionHistory;
                    isNewEntry = true;
                    hasDecimal = false;
                    break;

                // ── Equals ───────────────────────────────────────
                case "=":
                    if (currentOperator != "")
                    {
                        secondNumber = double.Parse(disp.Text);
                        expr.Text = $"{expressionHistory} {FormatNum(secondNumber)} =";
                        PerformCalc(disp, expr);
                        currentOperator = "";
                        expressionHistory = "";
                        isNewEntry = true;
                        hasDecimal = false;
                    }
                    break;

                // ── Percentage ───────────────────────────────────
                case "%":
                    double pVal = double.Parse(disp.Text) / 100.0;
                    disp.Text = FormatNum(pVal);
                    break;

                // ── Clear ─────────────────────────────────────────
                case "C":
                    disp.Text = "0";
                    expr.Text = "";
                    firstNumber = secondNumber = 0;
                    currentOperator = expressionHistory = "";
                    isNewEntry = true;
                    hasDecimal = false;
                    UpdateMode("STANDARD");
                    break;

                // ── Backspace ─────────────────────────────────────
                case "⌫":
                    if (disp.Text.Length > 1)
                    {
                        if (disp.Text[^1] == '.') hasDecimal = false;
                        disp.Text = disp.Text[..^1];
                    }
                    else { disp.Text = "0"; isNewEntry = true; }
                    break;

                // ── Scientific ───────────────────────────────────
                case "sin": case "cos": case "tan":
                    {
                        double deg = double.Parse(disp.Text);
                        double rad = deg * Math.PI / 180.0;
                        double res = val switch { "sin" => Math.Sin(rad), "cos" => Math.Cos(rad), _ => Math.Tan(rad) };
                        expr.Text = $"{val}({FormatNum(deg)}°) =";
                        disp.Text = FormatNum(res);
                        isNewEntry = true; hasDecimal = disp.Text.Contains('.');
                        UpdateMode("SCIENTIFIC");
                    }
                    break;

                case "√":
                    {
                        double n = double.Parse(disp.Text);
                        if (n < 0) { disp.Text = "Error"; isNewEntry = true; break; }
                        expr.Text = $"√({FormatNum(n)}) =";
                        disp.Text = FormatNum(Math.Sqrt(n));
                        isNewEntry = true; hasDecimal = disp.Text.Contains('.');
                        UpdateMode("SCIENTIFIC");
                    }
                    break;

                case "x²":
                    {
                        double n = double.Parse(disp.Text);
                        expr.Text = $"({FormatNum(n)})² =";
                        disp.Text = FormatNum(n * n);
                        isNewEntry = true; hasDecimal = disp.Text.Contains('.');
                        UpdateMode("SCIENTIFIC");
                    }
                    break;

                case "log":
                    {
                        double n = double.Parse(disp.Text);
                        if (n <= 0) { disp.Text = "Error"; isNewEntry = true; break; }
                        expr.Text = $"log({FormatNum(n)}) =";
                        disp.Text = FormatNum(Math.Log10(n));
                        isNewEntry = true; hasDecimal = disp.Text.Contains('.');
                        UpdateMode("SCIENTIFIC");
                    }
                    break;

                case "ln":
                    {
                        double n = double.Parse(disp.Text);
                        if (n <= 0) { disp.Text = "Error"; isNewEntry = true; break; }
                        expr.Text = $"ln({FormatNum(n)}) =";
                        disp.Text = FormatNum(Math.Log(n));
                        isNewEntry = true; hasDecimal = disp.Text.Contains('.');
                        UpdateMode("SCIENTIFIC");
                    }
                    break;

                // ── Unit Converters ───────────────────────────────
                case "°C→°F":
                    ConvertUnit(disp, expr, v => v * 9.0 / 5.0 + 32, "°C", "°F");
                    break;
                case "°F→°C":
                    ConvertUnit(disp, expr, v => (v - 32) * 5.0 / 9.0, "°F", "°C");
                    break;
                case "km→mi":
                    ConvertUnit(disp, expr, v => v * 0.621371, "km", "mi");
                    break;
                case "mi→km":
                    ConvertUnit(disp, expr, v => v * 1.60934, "mi", "km");
                    break;
                case "kg→lb":
                    ConvertUnit(disp, expr, v => v * 2.20462, "kg", "lb");
                    break;
                case "lb→kg":
                    ConvertUnit(disp, expr, v => v * 0.453592, "lb", "kg");
                    break;
            }
            ShrinkTextIfNeeded(disp);
        }

        // ════════════════════════════════════════════════════════
        //  HELPERS
        // ════════════════════════════════════════════════════════
        private void PerformCalc(Label disp, Label expr)
        {
            double a = firstNumber;
            double b = double.Parse(disp.Text);
            double result = currentOperator switch
            {
                "+" => a + b,
                "−" => a - b,
                "×" => a * b,
                "÷" => b == 0 ? double.NaN : a / b,
                _   => b
            };
            disp.Text = double.IsNaN(result) ? "Div/0 Error" : FormatNum(result);
            if (!double.IsNaN(result))
            {
                firstNumber = result;
                hasDecimal = disp.Text.Contains('.');
            }
        }

        private void ConvertUnit(Label disp, Label expr,
            Func<double, double> fn, string from, string to)
        {
            if (!double.TryParse(disp.Text, out double val)) return;
            double res = fn(val);
            expr.Text = $"{FormatNum(val)} {from} → {to} =";
            disp.Text = FormatNum(res);
            isNewEntry = true;
            hasDecimal = disp.Text.Contains('.');
            UpdateMode("CONVERTER");
        }

        private static string FormatNum(double v)
        {
            if (double.IsNaN(v) || double.IsInfinity(v)) return "Error";
            // Show up to 10 significant digits, strip trailing zeros
            string s = v.ToString("G10");
            return s;
        }

        private void ShrinkTextIfNeeded(Label disp)
        {
            // Auto-shrink font for long numbers
            float fs = disp.Text.Length > 14 ? 18f :
                       disp.Text.Length > 10 ? 22f : 28f;
            disp.Font = new Font("Consolas", fs, FontStyle.Bold);
        }

        private void UpdateMode(string mode)
        {
            Label lbl = (Label)this.Controls["lblMode"];
            (lbl.Text, lbl.ForeColor) = mode switch
            {
                "SCIENTIFIC" => ("● SCIENTIFIC", SCI_BTN),
                "CONVERTER"  => ("● CONVERTER",  CONV_BTN),
                _            => ("● STANDARD",   EQ_BTN)
            };
        }
    }
}
