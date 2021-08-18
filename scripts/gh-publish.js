#!/usr/bin/env node

const path = require("path")
const { spawn } = require("child_process")
const fs = require("fs")

async function ghPublish() {
  const rootDir = getRootDir()
  const tmpDir = path.resolve(__dirname, "./../gh-pages")
  const origin = await spawnAsync("git", ["config", "--get", "remote.origin.url"], { cwd: rootDir })

  if (!fs.existsSync(tmpDir)) {
    await spawnAsync("git", ["clone", "--branch", "gh-pages", origin, tmpDir])
  }
  else {
    await spawnAsync("git", ["pull", "origin", "gh-pages"], { cwd: tmpDir })
  }

  // clean tmp
  await spawnAsync("rm", ["-r", "*"], { cwd: tmpDir, shell: true })

  // npm run build
  await spawnAsync("npm", ["run", "build"], { cwd: rootDir, shell: true })

  // copy dist -> tmp
  await spawnAsync("cp", ["-a", "./dist/.", tmpDir], { cwd: rootDir })

  // git add .
  await spawnAsync("git", ["add", "."], { cwd: tmpDir })

  // git status --porcelain
  const gitStatus = await spawnAsync("git", ["status", "--porcelain"], { cwd: tmpDir })

  // commit if any changes
  if (gitStatus) {
    await spawnAsync("git", ["commit", "-m", "auto commit"], { cwd: tmpDir })
  }

  // git push origin gh-pages
  await spawnAsync("git", ["push", "origin", "gh-pages"], { cwd: tmpDir })
}

function getRootDir() {
  return path.resolve(__dirname, "./../")
}

function spawnAsync(command, args, options) {
  const childProcess = spawn(command, args, options)
  let stdoutData = ""
  let stderrData = ""

  childProcess.stdout.on("data", handleStdoutData)
  childProcess.stderr.on("data", handleStderrData)

  function handleStdoutData(data) {
    data = String(data)

    console.log(data)
    stdoutData += data
  }

  function handleStderrData(data) {
    data = String(data)

    console.error(data)
    stderrData += data
  }

  return new Promise(function (resolve, reject) {
    childProcess.on("close", function (code) {
      childProcess.stdout.off("data", handleStdoutData)
      childProcess.stderr.off("data", handleStderrData)

      if (code === 0) {
        resolve(stdoutData.trim())
      }
      else {
        reject(new Error(stderrData || `command "${command} ${args.join(" ")}" exited with code ${code}`))
      }
    })
  })
}

module.ghPublish = ghPublish

if (require.main === module) {
  ghPublish().catch(err => console.error(err))
}


