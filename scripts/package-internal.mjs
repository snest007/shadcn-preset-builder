import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, "..")

const packageJsonPath = join(rootDir, "package.json")
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
const packageName = packageJson.name ?? "plugin"
const packageVersion = packageJson.version ?? "0.0.0"

const releaseDir = join(rootDir, "release")
const stagedDirName = `${packageName}-${packageVersion}`
const stagedDir = join(releaseDir, stagedDirName)
const zipFileName = `${packageName}-v${packageVersion}-internal.zip`
const zipFilePath = join(releaseDir, zipFileName)

const filesToStage = ["manifest.json", "README.md", "dist"]

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status ?? "unknown"}`)
  }
}

function commandExists(command) {
  const result = spawnSync("which", [command], { stdio: "ignore" })

  return result.status === 0
}

for (const relativePath of filesToStage) {
  if (!existsSync(join(rootDir, relativePath))) {
    throw new Error(`Missing required build artifact: ${relativePath}`)
  }
}

rmSync(stagedDir, { recursive: true, force: true })
rmSync(zipFilePath, { force: true })
mkdirSync(stagedDir, { recursive: true })

for (const relativePath of filesToStage) {
  cpSync(join(rootDir, relativePath), join(stagedDir, relativePath), {
    recursive: true,
  })
}

if (commandExists("zip")) {
  runCommand("zip", ["-r", zipFilePath, stagedDirName], {
    cwd: releaseDir,
  })
} else if (process.platform === "darwin" && commandExists("ditto")) {
  runCommand("ditto", [
    "-c",
    "-k",
    "--keepParent",
    stagedDir,
    zipFilePath,
  ])
} else {
  throw new Error(
    "Unable to create zip archive. Install the zip command or run this script on macOS with ditto available.",
  )
}

console.log(`Created ${zipFilePath}`)
