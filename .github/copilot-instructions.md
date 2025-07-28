# Bananagrams Project - Development Guidelines

This is a Vite React TypeScript app with Tailwind CSS and Prettier (with Tailwind plugin) configured. ESLint is set to warn on unused variables. No Electron setup is included.

## 🧠 React Compiler Best Practices

React Compiler is enabled in this project to optimize performance and reduce the need for manual memoization. Copilot should follow these guidelines when generating or suggesting code:

### ✅ Use Clean, Declarative Code  
- Prefer simple, pure function components.
- Avoid unnecessary abstractions or premature optimizations.

### 🧹 Avoid Manual Memoization (unless necessary)  
- **Do not use** `useMemo`, `useCallback`, or `React.memo` unless profiling clearly shows a need.
- Let the compiler automatically apply memoization based on usage.

### 🪝 Follow the Rules of React  
- Always call hooks at the top level of function components.
- Never conditionally call hooks.
- Treat props and state as **immutable**.
- Avoid any side effects in render or hook bodies—place those in `useEffect` or `useLayoutEffect`.

### 🚨 Use ESLint to Enforce Compatibility  
- The `eslint-plugin-react-compiler` plugin is enabled.
- Fix any violations it reports to ensure compiler compatibility.

### 🔁 Don't Re-implement Compiler Logic  
- Avoid manual dependency arrays on hooks unless needed—React Compiler infers them accurately.
- Don't write fallback logic for memoization or optimizations the compiler already handles.

### 🧪 Prefer Profiling over Premature Optimization  
- Trust the compiler first. Only revert to manual optimization if there's measurable performance cost.
- Use Chrome React DevTools to inspect optimizations ("Memo ✨" badges on components).

## Technical Stack

- **React**: 19.1.0 (with React Compiler enabled)
- **TypeScript**: ~5.8.3
- **Vite**: ^7.0.4
- **Tailwind CSS**: ^4.1.11
- **ESLint**: ^9.30.1 with React Compiler plugin
- **Prettier**: ^3.6.2 with Tailwind plugin

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
