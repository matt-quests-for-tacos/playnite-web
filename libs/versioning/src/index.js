const semver = require('semver')
const { groupBy } = require('lodash')
const debug = require('debug')('playnite-web/versioning')

const getDockerTags = async (version, ref) => {
  debug(`version: ${version}`)
  debug(`ref: ${ref}`)

  let tags = []

  if (/^refs\/pull\//.test(ref)) {
    const prNumber = ref.replace(/^refs\/pull\//, '').replace(/\/merge$/, '')

    if (prNumber) {
      tags.push(`PR-${prNumber}`)
    }
  } else if (/^refs\/tags\//.test(ref)) {
    const major = semver.major(version)
    const minor = semver.minor(version)
    tags.push(`${major}.${minor}-latest`)

    const latestMajors = Object.entries(
      groupBy(
        sh
          .exec(`git tag --sort=-creatordate`)
          .stdout.split('\n')
          .map((tag) => tag.replace(/^v/, ''))
          .sort(semver.compare),
        semver.major,
      ),
    ).map(([major, tags]) => [major, tags[0]])

    const matchingLatestMajor = latestMajors.find(
      ([major, tag]) => major === semver.major(version) && tag === version,
    )
    if (matchingLatestMajor) {
      tags.push(`${matchingLatestMajor[0]}-latest`)
    }
  } else if (/^refs\/heads\/main$/.test(ref)) {
    tags.push(`dev`)
  }

  debug(`tags: ${tags.join(', ')}`)

  return tags
}

module.exports = { getDockerTags }
