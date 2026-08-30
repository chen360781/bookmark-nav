import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			"dist",
			// `wrangler types` 自动生成的声明文件,内含第三方类型与无效 disable 指令
			"**/worker-configuration.d.ts",
		],
	},
	{
		extends: [js.configs.recommended, ...tseslint.configs.recommended],
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
		},
		plugins: {
			"react-hooks": reactHooks,
			"react-refresh": reactRefresh,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			"react-refresh/only-export-components": [
				"warn",
				{ allowConstantExport: true },
			],
		},
	},
	{
		// components/ui 由 shadcn 生成并托管:组件与 cva 变体同文件导出是其固有模式,
		// 本地改动会被 shadcn CLI 覆盖,因此不对该目录强制 fast refresh 约束
		files: ["src/react-app/components/ui/**/*.{ts,tsx}"],
		rules: {
			"react-refresh/only-export-components": "off",
		},
	},
);
