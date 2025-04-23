import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import htmlPlugin from 'eslint-plugin-html';

export default defineConfig([
  // Базовые рекомендованные правила ESLint
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended'],
  },
  // Настройки для Node.js и Node-RED
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest', // Поддержка последней версии ECMAScript
      sourceType: 'module', // Использование ESM (или "commonjs" для CommonJS)
      globals: {
        ...globals.node, // Глобальные переменные Node.js
        RED: 'readonly', // Глобальная переменная Node-RED
        node: 'readonly', // Глобальная переменная node
      },
    },
    rules: {
      'no-console': 'off', // Разрешить console.log
      indent: ['error', 2], // Отступы в 2 пробела
      quotes: ['error', 'single'], // Одинарные кавычки
      semi: ['error', 'always'], // Точка с запятой обязательна
      'no-unused-vars': [
        'warn', // Предупреждение вместо ошибки
        { argsIgnorePattern: '^_' }, // Игнорировать переменные с префиксом _
      ],
    },
  },
  {
    files: ['**/*.html'],
    plugins: {
      html: htmlPlugin, // Добавляем плагин как объект
    }, // Добавляем поддержку HTML
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {},
  },
]);
