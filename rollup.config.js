import { dts } from "rollup-plugin-dts"

const config = [
  {
    input: "./lib/index.d.ts",
    output: [{ file: "dist/entt.d.ts", format: "es" }],
    plugins: [dts()],
  },
]

export default config
