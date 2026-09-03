# CloudChess ♟️

A real-time multiplayer online chess platform — quick play, no sign-ups.

Pick a username, create or join a room, and play chess instantly.

## What is this?

CloudChess is a **Cloud Engineering portfolio project**. The application is a real-time chess game, but the real project is the infrastructure underneath — deployment, networking, security, scaling, monitoring, and automation on AWS.

## Architecture

**Current:** Local development

```
Player A ──WebSocket──→ Python Backend ←──WebSocket── Player B
```

**Target:** AWS cloud infrastructure

```
Internet → Route 53 → ALB → EC2 (Docker) → RDS
                                ↓
                              Redis (shared state)
                                ↓
                         S3 + CloudWatch + IAM
                    All managed via Terraform + CI/CD
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python 3.11+, FastAPI, uvicorn |
| Real-time | WebSocket |
| Game Logic | python-chess |
| Containerization | Docker |
| Infrastructure | AWS (VPC, EC2, RDS, S3, IAM, Route 53) |
| IaC | Terraform |
| CI/CD | GitHub Actions |
| Monitoring | CloudWatch |

## Project Structure

```
cloudchess/
├── frontend/          — Chess UI (HTML/CSS/JS)
├── backend/           — Python FastAPI server
├── infrastructure/    — Terraform configs
├── scripts/           — Deployment & utility scripts
├── docs/              — Architecture docs, incidents, decisions
├── load-tests/        — Load testing scripts
├── .gitignore
├── README.md
└── LICENSE
```

## How to Play

> Coming soon — app is under development.

## Infrastructure Phases

- [ ] Docker containerization
- [ ] AWS VPC & networking
- [ ] EC2 deployment
- [ ] RDS (PostgreSQL)
- [ ] S3 storage
- [ ] Terraform (IaC)
- [ ] CloudWatch monitoring
- [ ] Reliability & failure testing
- [ ] ALB + Auto Scaling + Redis
- [ ] CI/CD with GitHub Actions

## License

MIT
