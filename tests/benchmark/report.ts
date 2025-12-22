#!/usr/bin/env ts-node
import fs from 'node:fs/promises'
import path from 'node:path'

interface BenchmarkRow {
	name: string
	baseline?: number
	candidate?: number
	delta?: number
	deltaPct?: number
}

type ColorMode = 'ansi' | 'html' | 'plain'

interface CliOptions {
	baselineLabel: string
	candidateLabel: string
	sort: 'delta' | 'name' | 'ratio'
	top?: number
	ansiColor: boolean
	markdownColor: boolean
	markdownOut?: string
}

const numberPattern = /([0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?)/i
const secondsPattern = new RegExp(String.raw`^\s*${numberPattern.source}\s+seconds`, 'i')

const ANSI = {
	green: (text: string) => `\x1b[32m${text}\x1b[0m`,
	red: (text: string) => `\x1b[31m${text}\x1b[0m`
}

const defaultAnsiColor = process.stdout.isTTY && process.env.NO_COLOR == null
const defaultMarkdownColor = true

function toBool (value: string | boolean | undefined | null): boolean {
	if (value === undefined || value === null) return true
	if (typeof value === 'boolean') return value
	const normalized = value.toLowerCase()
	return !['false', '0', 'no', 'off'].includes(normalized)
}

async function parseBenchmarkLog (filePath: string): Promise<Map<string, number>> {
	const content = await fs.readFile(filePath, 'utf8')
	const lines = content.split(/\r?\n/)
	const results = new Map<string, number>()
	let current: string | null = null

	for (const rawLine of lines) {
		const line = rawLine.trimEnd()
		const runMatch = line.match(/^\[\s*RUN\s*\]\s+(Benchmark\.[A-Za-z0-9_]+)\s*$/)
		if (runMatch) {
			current = runMatch[1]
			continue
		}

		if (current != null) {
			const secondsMatch = line.match(secondsPattern)
			if (secondsMatch) {
				const seconds = Number(secondsMatch[1])
				if (!Number.isNaN(seconds)) {
					results.set(current, seconds)
				}
				current = null
			}
		}
	}

	return results
}

function parseArgs (): { files: [string, string], options: CliOptions } {
	const argv = process.argv.slice(2)
	const positional: string[] = []
	const flags = new Map<string, string | boolean>()

	for (const arg of argv) {
		if (arg.startsWith('--')) {
			const [key, value] = arg.slice(2).split('=')
			flags.set(key, value ?? 'true')
		} else {
			positional.push(arg)
		}
	}

	if (positional.length < 2) {
		console.error('Usage: node report.ts <baseline-log> <candidate-log> [--baseline-label=name] [--candidate-label=name] [--sort=delta|name|ratio] [--top=N] [--markdown-out=path]')
		process.exit(1)
	}

	const [baselinePath, candidatePath] = positional as [string, string]
	const baselineLabel = String(flags.get('baseline-label') ?? path.basename(baselinePath))
	const candidateLabel = String(flags.get('candidate-label') ?? path.basename(candidatePath))
	const sortFlag = (flags.get('sort') ?? 'delta') as CliOptions['sort']
	const validSort = new Set(['delta', 'name', 'ratio'])
	const sort = validSort.has(sortFlag) ? sortFlag : 'delta'
	const topFlag = flags.get('top')
	const top = topFlag != null ? Number(topFlag) : undefined

	let ansiColor = defaultAnsiColor
	if (flags.has('color')) {
		ansiColor = toBool(flags.get('color'))
	}
	if (flags.has('no-color')) {
		ansiColor = false
	}

	let markdownColor = defaultMarkdownColor
	if (flags.has('markdown-color')) {
		markdownColor = toBool(flags.get('markdown-color'))
	}
	if (flags.has('no-markdown-color')) {
		markdownColor = false
	}

	let markdownOut: string | undefined
	if (flags.has('markdown-out')) {
		const value = flags.get('markdown-out')
		if (typeof value === 'string' && value.length > 0) {
			markdownOut = path.resolve(value)
		}
	}

	return {
		files: [baselinePath, candidatePath],
		options: {
			baselineLabel,
			candidateLabel,
			sort,
			top: Number.isFinite(top) ? top : undefined,
			ansiColor,
			markdownColor,
			markdownOut
		}
	}
}

function buildRows (baseline: Map<string, number>, candidate: Map<string, number>): BenchmarkRow[] {
	const names = new Set([...baseline.keys(), ...candidate.keys()])
	const rows: BenchmarkRow[] = []

	for (const name of names) {
		const base = baseline.get(name)
		const cand = candidate.get(name)
		const row: BenchmarkRow = { name, baseline: base, candidate: cand }

		if (typeof base === 'number' && typeof cand === 'number') {
			row.delta = cand - base
			row.deltaPct = base === 0 ? undefined : ((cand - base) / base) * 100
		}

		rows.push(row)
	}

	return rows
}

function sortRows (rows: BenchmarkRow[], sort: CliOptions['sort']): BenchmarkRow[] {
	const clone = [...rows]
	if (sort === 'name') {
		clone.sort((a, b) => a.name.localeCompare(b.name))
		return clone
	}
	if (sort === 'ratio') {
		clone.sort((a, b) => {
			const ratioA = ratioValue(a)
			const ratioB = ratioValue(b)
			return ratioB - ratioA
		})
		return clone
	}

	clone.sort((a, b) => {
		const deltaA = a.delta ?? 0
		const deltaB = b.delta ?? 0
		return Math.abs(deltaB) - Math.abs(deltaA)
	})
	return clone
}

function ratioValue (row: BenchmarkRow): number {
	if (typeof row.baseline !== 'number' || typeof row.candidate !== 'number' || row.baseline === 0) {
		return 1
	}
	return row.candidate / row.baseline
}

function formatNumber (value: number | undefined, digits = 6): string {
	return typeof value === 'number' ? value.toFixed(digits) : '-'
}

function formatSigned (value: number | undefined, digits = 6): string {
	if (typeof value !== 'number') return '-'
	const sign = value >= 0 ? '+' : ''
	return `${sign}${value.toFixed(digits)}`
}

function formatPercent (value: number | undefined): string {
	if (typeof value !== 'number') return '-'
	const sign = value >= 0 ? '+' : ''
	return `${sign}${value.toFixed(2)}%`
}

function colorDelta (text: string, delta: number | undefined, mode: ColorMode): string {
	if (typeof delta !== 'number' || delta === 0) return text
	if (mode === 'ansi') {
		return delta < 0 ? ANSI.green(text) : ANSI.red(text)
	}
	if (mode === 'html') {
		const color = delta < 0 ? '#2ecc71' : '#e74c3c'
		return `<span style="color:${color}">${text}</span>`
	}
	return text
}

function renderTable (rows: BenchmarkRow[], options: CliOptions, mode: ColorMode): string {
	const header = `| Benchmark | ${options.baselineLabel} (s) | ${options.candidateLabel} (s) | Δ (s) | Δ% |`
	const separator = '| - | -: | -: | -: | -: |'
	const lines = rows.map((row) => {
		const deltaStr = colorDelta(formatSigned(row.delta), row.delta, mode)
		const deltaPctStr = colorDelta(formatPercent(row.deltaPct), row.delta, mode)
		return `| ${row.name} | ${formatNumber(row.baseline)} | ${formatNumber(row.candidate)} | ${deltaStr} | ${deltaPctStr} |`
	})
	return [header, separator, ...lines].join('\n')
}

function colorLabel (label: string, highlight: boolean, mode: ColorMode, positive: boolean): string {
	if (!highlight) return label
	if (mode === 'ansi') {
		return positive ? ANSI.green(label) : ANSI.red(label)
	}
	if (mode === 'html') {
		const color = positive ? '#2ecc71' : '#e74c3c'
		return `<span style="color:${color}">${label}</span>`
	}
	return label
}

function summarize (rows: BenchmarkRow[], mode: ColorMode): string {
	let faster = 0
	let slower = 0
	let equal = 0

	for (const row of rows) {
		if (typeof row.delta === 'number') {
			if (row.delta < 0) faster += 1
			else if (row.delta > 0) slower += 1
			else equal += 1
		}
	}

	const total = rows.length
	const fasterLabel = colorLabel(`${faster} faster`, faster > 0, mode, true)
	const slowerLabel = colorLabel(`${slower} slower`, slower > 0, mode, false)
	return `Summary: ${fasterLabel} · ${slowerLabel} · ${equal} unchanged · ${total} comparisons.`
}

async function main (): Promise<void> {
	const { files, options } = parseArgs()
	const [baselinePath, candidatePath] = files
	const [baseline, candidate] = await Promise.all([
		parseBenchmarkLog(baselinePath),
		parseBenchmarkLog(candidatePath)
	])

	const rows = buildRows(baseline, candidate)
	const sorted = sortRows(rows, options.sort)
	const limited = options.top != null ? sorted.slice(0, options.top) : sorted

	const consoleMode: ColorMode = options.ansiColor ? 'ansi' : 'plain'
	console.log(`# Benchmark Comparison (Console View)`)
	console.log(`Comparing **${options.baselineLabel}** ↔ **${options.candidateLabel}**`)
	console.log('')
	console.log(renderTable(limited, options, consoleMode))
	console.log('')
	console.log(summarize(rows, consoleMode))

	if (options.markdownOut) {
		const markdownMode: ColorMode = options.markdownColor ? 'html' : 'plain'
		const markdownLines = [
			'# Benchmark Comparison',
			`Comparing **${options.baselineLabel}** ↔ **${options.candidateLabel}**`,
			'',
			renderTable(limited, options, markdownMode),
			'',
			summarize(rows, markdownMode),
			''
		]
		await fs.writeFile(options.markdownOut, markdownLines.join('\n'), 'utf8')
		console.log(`\nMarkdown report written to ${options.markdownOut}`)
	}
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
