# 🌿 YogiAI - Wellness RAG Intelligence Platform

![Project Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Platform](https://img.shields.io/badge/Platform-Android-blue)
![Tech](https://img.shields.io/badge/Built%20With-React%20Native%20%7C%20Expo-61DAFB)

**YogiAI** is a specialized, voice-enabled AI micro-application acting as a personal wellness assistant. It uses **Retrieval-Augmented Generation (RAG)** to provide accurate, context-aware answers regarding yoga, mental health, and wellness routines, ensuring reliability over generic AI models.

---

## 📖 Table of Contents
- [Abstract](#abstract)
- [Problem Statement](#problem-statement)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Installation & Setup](#installation--setup)
- [How to Build (APK)](#how-to-build-apk)
- [Project Structure](#project-structure)
- [Challenges & Solutions](#challenges--solutions)

---

## 📝 Abstract
General-purpose AI often "hallucinates" when asked specific medical or wellness questions. YogiAI solves this by grounding its responses in a curated wellness knowledge base. The app features a voice-first interface, making it easy for users to ask questions hands-free during yoga sessions.

---

## 🎯 Problem Statement
Users practicing yoga or meditation often need quick, reliable answers without scrolling through ads or reading long articles. Generic chatbots lack specific domain authority. YogiAI bridges this gap by combining:
1.  **Voice Interaction** for hands-free use.
2.  **RAG Technology** for verified, trustworthy answers.
3.  **Mobile-First Design** for on-the-go accessibility.

---

## 🏗 System Architecture

The app follows a client-server model augmented by an AI processing layer:

1.  **User Input:** Voice/Text query captured by the Mobile App.
2.  **API Layer:** Request sent to backend.
3.  **Vector Search:** Query converted to embeddings -> Search Knowledge Base.
4.  **LLM Generation:** Relevant docs + Query sent to LLM for synthesis.
5.  **Response:** Final answer returned to user.

> ![Architecture Diagram](https://via.placeholder.com/800x400?text=Insert+Architecture+Diagram+Here)
> *(Replace this link with your actual diagram screenshot if available)*

---

## 💻 Technology Stack

### **Frontend (Mobile)**
* **Framework:** React Native (Expo SDK 52)
* **Language:** TypeScript / JavaScript
* **Navigation:** Expo Router
* **Audio:** `expo-av`
* **Native Config:** `expo-build-properties`

### **DevOps & Build**
* **Build Tool:** Gradle 8.14.3
* **Environment:** OpenJDK 17 (Temurin)
* **Platform:** Android (APK)

---

## 🚀 Installation & Setup

### Prerequisites
* **Node.js** (LTS version)
* **Java JDK 17** (Crucial: JDK 24 is not supported)
* **Android Studio SDK** (for local builds)

### 1. Clone the Repository
```bash
git clone [https://github.com/YOUR_USERNAME/yogiai.git](https://github.com/YOUR_USERNAME/yogiai.git)
cd yogiai
