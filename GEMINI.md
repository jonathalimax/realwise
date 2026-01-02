# Project: Lima's Finance

## Project Overview

This is a personal finance tracker web application built with React, Vite, and Tailwind CSS. It uses Firebase for authentication and Firestore as the database. The application allows users to track their income and expenses, view a balance summary, and manage their transaction history. It features a responsive design and secure user authentication.

## Building and Running

### Key Commands

*   **Install Dependencies:**
    ```bash
    npm install
    ```

*   **Run in Development Mode:**
    Starts the development server at `http://localhost:5173`.
    ```bash
    npm run dev
    ```

*   **Build for Production:**
    Builds the application for production in the `dist` directory.
    ```bash
    npm run build
    ```

*   **Lint the Code:**
    Runs ESLint to check for code quality and style issues.
    ```bash
    npm run lint
    ```

*   **Preview Production Build:**
    Starts a local server to preview the production build.
    ```bash
    npm run preview
    ```

### Firebase Setup

This project requires a Firebase project for authentication and database services. You will need to:

1.  Create a Firebase project.
2.  Enable Email/Password and/or Google sign-in methods in Firebase Authentication.
3.  Create a Firestore database.
4.  Set up Firestore security rules as described in the `README.md`.
5.  Create a `.env` file with your Firebase project configuration (use `.env.example` as a template).

## Development Conventions

*   **Styling:** The project uses Tailwind CSS for styling. Utility classes are preferred over custom CSS.
*   **Components:** The application is built with React components, located in the `src/components` directory.
*   **Linting:** ESLint is used for linting. It's recommended to run `npm run lint` before committing changes.
*   **State Management:** The project uses React Context for managing state related to settings, cards, budget, goals, and investments.
*   **Internationalization (i18n):** The application supports multiple languages. Locale files are located in `src/locales`.
*   **Routing:** The application uses React Router for navigation. The pages are located in `src/pages` and `landing_page/pages`.
