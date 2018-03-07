# Node.js Release Process

This document describes the technical aspects of the Node.js release process.
The intended audience is those who have been authorized by the Node.js
Foundation Technical Steering Committee (TSC) to create, promote, and sign
official release builds for Node.js, hosted on <https://nodejs.org/>.

## Who can make a release?

Once authorized, an individual must have the following:

### 1. Jenkins Release Access

There are two relevant Jenkins jobs that should be used for a release flow:

**a.** **Test runs:**
**[node-test-pull-request](https://ci.nodejs.org/job/node-test-pull-request/)**
is used for a final full-test run to ensure that the current *HEAD* is stable.

**b.** **Release/Nightly builds:**
**[iojs+release](https://ci-release.nodejs.org/job/iojs+release/)** does all of
the work to build all required release assets. Promotion of the release files is
a manual step once they are ready (see below).

`iojs+release` can also be used to create a nightly release for the current
*HEAD* if public test releases are required. Builds triggered with this job are
published straight to <https://nodejs.org/download/nightly/> and are available
for public download.

The [Node.js build team](https://github.com/nodejs/build) is able to provide
this access to individuals authorized by the TSC.

### 2. <nodejs.org> Access

The _dist_ user on nodejs.org controls the assets available in
<https://nodejs.org/download/>. <https://nodejs.org/dist/> is an alias for
<https://nodejs.org/download/release/>.

The Jenkins release build workers upload their artifacts to the web server as
the _staging_ user. The _dist_ user has access to move these assets to public
access while, for security, the _staging_ user does not.

Nightly builds are promoted automatically on the server by a cron task for the
_dist_ user.

Release builds require manual promotion by an individual with SSH access to the
server as the _dist_ user. The
[Node.js build team](https://github.com/nodejs/build) is able to provide this
access to individuals authorized by the TSC.

### 3. A Publicly Listed GPG Key

A SHASUMS256.txt file is produced for every promoted build, nightlies and
releases. Additionally for releases, this file is signed by the individual
responsible for that release. In order to be able to verify downloaded binaries,
the public should be able to check that the SHASUMS256.txt file has been signed
by someone who has been authorized to create a release.

The GPG keys should be fetchable from a known third-party keyserver. The SKS
Keyservers at <https://sks-keyservers.net> are recommended. Use the
[submission](https://pgp.mit.edu/) form to submit a new GPG key. Keys should be
fetchable via:

```console
$ gpg --keyserver pool.sks-keyservers.net --recv-keys <FINGERPRINT>
```

The key you use may be a child/subkey of an existing key.

Additionally, full GPG key fingerprints for individuals authorized to release
should be listed in the Node.js GitHub README.md file.

## How to create a release

Notes:

- Dates listed below as _"YYYY-MM-DD"_ should be the date of the release **as
  UTC**. Use `date -u +'%Y-%m-%d'` to find out what this is.
- Version strings are listed below as _"vx.y.z"_. Substitute for the release
  version.

### 2. Cherry-picking from `master` and other branches

Checkout `${BRANCH}-staging`. Using `git cherry-pick`, bring the appropriate
commits into your new branch. To determine the relevant commits, use
[`branch-diff`](https://github.com/rvagg/branch-diff) and
[`changelog-maker`](https://github.com/rvagg/changelog-maker/) (both are
available on npm and should be installed globally). These tools depend on our
commit metadata, as well as the `semver-minor` and `semver-major` GitHub labels.
One drawback is that when the `PR-URL` metadata is accidentally omitted from a
commit, the commit will show up because it's unsure if it's a duplicate or not.

For a list of commits that could be landed in a patch release on `${BRANCH}`:

```console
$ branch-diff v5.x master --exclude-label=semver-major,semver-minor,dont-land-on-v5.x --filter-release --format=simple
```

Carefully review the list of commits looking for errors (incorrect `PR-URL`,
incorrect semver, etc.). Commits labeled as semver minor or semver major should
only be cherry-picked when appropriate for the type of release being made.
Previous release commits and version bumps do not need to be cherry-picked.


Create a new branch named `v${VERSION}-proposal` based on `v${BRANCH}-staging`:

```c
#define NODE_MAJOR_VERSION x
#define NODE_MINOR_VERSION y
#define NODE_PATCH_VERSION z
```


### 3. Update `src/node_version.h`

Update the macros:

```bash
# Needed for every release.
sed -i "s/NODE_VERSION_IS_RELEASE 0\$/NODE_VERSION_IS_RELEASE 1/" src/node_version.h

# Only needed for major bumps or first LTS releases:
sed -i "s/NODE_MAJOR_VERSION [0-9]\+\$/NODE_MAJOR_VERSION ${MAJOR}/" src/node_version.h
sed -i "s/NODE_MINOR_VERSION [0-9]\+\$/NODE_MINOR_VERSION ${MINOR}/" src/node_version.h
sed -i "s/NODE_PATCH_VERSION [0-9]\+\$/NODE_PATCH_VERSION ${PATCH}/" src/node_version.h
sed -i "s/NODE_VERSION_IS_LTS [0-1]\$/NODE_VERSION_IS_LTS ${IS_LTS}/" src/node_version.h
sed -i "s/NODE_VERSION_LTS_CODENAME \"\$/NODE_VERSION_LTS_CODENAME 1/" src/node_version.h
```

Setting `NODE_VERSION_IS_RELEASE` to `1` causes the build to be produced with a
version string that does not have a trailing pre-release tag.

*[First LTS]*: If this is the first LTS release for this release line, check
`NODE_VERSION_IS_LTS` is `1`, and `NODE_VERSION_LTS_CODENAME` is the codename
for that release (e.g. `"Carbon"`).

- Determining what API to work against for compiling native addons, e.g.
  [NAN](https://github.com/nodejs/nan) uses it to form a compatibility-layer for
  much of what it wraps.
- Determining the ABI for downloading pre-built binaries of native addons, e.g.
  [node-pre-gyp](https://github.com/mapbox/node-pre-gyp) uses this value as
  exposed via `process.versions.modules` to help determine the appropriate
  binary to download at install-time.

This macro is used to signal an ABI version for native addons.

The general rule is to bump this version when there are _breaking or non-trivial
ABI changes_. The rules are not yet strictly defined, so if in doubt, please
confer with someone that will have a more informed perspective, such as a member
of the NAN team.

*Note*: It is current TSC policy to bump major version when ABI changes. If you
see a need to bump `NODE_MODULE_VERSION` then you should consult the TSC.
Commits may need to be reverted or a major version bump may need to happen.

### 4. Update the Changelog

#### Step 1: Collecting the formatted list of changes:

Collect a formatted list of commits since the last release. Use
[`changelog-maker`](https://github.com/rvagg/changelog-maker) to do this. The
start-ref should be the last released version.

```bash
changelog-maker --group --filter-release --start-ref v${PREVIOUS}
```

#### Step 2: Update the appropriate doc/changelogs/CHANGELOG_*.md file

There is a separate `CHANGELOG_${MAJOR}.md` file for each major Node.js release line.
These are located in the `doc/changelogs/` directory. Once the formatted list of
changes is collected, it must be added to the top of the relevant changelog file
in the release branch (e.g. for Node.js v8.x change
`/doc/changelogs/CHANGELOG_V8.md`).

**Please do *not* add the changelog entries to the root `CHANGELOG.md` file.**

The new entry should take the following form:

```md
<a id="x.y.x"></a>
## YYYY-MM-DD, Version x.y.z (Release Type), @releaser

### Notable changes

* List interesting changes here
* Particularly changes that are responsible for minor or major version bumps
* Also be sure to look at any changes introduced by dependencies such as npm
* ... and include any notable items from there

### Commits

* Include the full list of commits since the last release here. Do not include "Working on X.Y.Z+1" commits.
```

`${RELEASE_TYPE}` should be either Current, LTS, or Maintenance.

Be sure that the `<a>` tag and the two headings are not indented at all.

At the top of each `CHANGELOG_*.md` file, and in the root `CHANGELOG.md` file,
there is a table indexing all releases in each major release line. A link to the
new release needs to be added to each. Follow the existing examples and be sure
to add the release to the *top* of the list.

In the root `CHANGELOG.md` file, the most recent release for each release line
is shown in **bold** in the index. When updating the index, please make sure to
update the display accordingly by removing the bold styling from the previous
release.

#### Step 3: Update any REPLACEME and DEP00XX tags in the docs

If this release includes new APIs then it is necessary to document that they
were first added in this version. The relevant commits should already include
`REPLACEME` tags as per the example in the
[docs README](../tools/doc/README.md). Check for these tags with `grep REPLACEME
doc/api/*.md`, and substitute this node version with `sed -i
"s/REPLACEME/$VERSION/g" doc/api/*.md` or `perl -pi -e "s/REPLACEME/$VERSION/g"
doc/api/*.md`.

*Note*: `$VERSION` should be prefixed with a `v`

If this release includes any new deprecations it is necessary to ensure that
those are assigned a proper static deprecation code. These are listed in the
docs (see `doc/api/deprecations.md`) and in the source as `DEP00XX`. The code
must be assigned a number (e.g. `DEP0012`). Note that this assignment should
occur when the PR is landed, but a check will be made when the release build is
run.

### 5. Create Release Commit

The `CHANGELOG.md`, `doc/changelogs/CHANGELOG_*.md`, `src/node_version.h`, and
`REPLACEME` changes should be the final commit that will be tagged for the
release. When committing these to git, use the following message format:

```txt
${DATE} Version ${VERSION} ${CODENAME} (${RELEASE_TYPE})

Notable changes:

* Copy the notable changes list here, reformatted for plain-text
```

### 6. Propose Release on GitHub

Push the release branch to `nodejs/node`, not to your own fork. This allows
release branches to more easily be passed between members of the release team if
necessary.

Create a pull request targeting `${BRANCH}`. For example, a v8.9.0-proposal PR
should target v8.x, not master. Paste the CHANGELOG modifications into the body
of the PR so that collaborators can see what is changing. These PRs should be
left open for at least 24 hours, and can be updated as new commits land.

If you need any additional information about any of the commits, this PR is a
good place to @-mention the relevant contributors.

Update the release commit to include `PR-URL:` metadata.

### 7. Ensure that the Release Branch is Stable

Run a
**[node-test-pull-request](https://ci.nodejs.org/job/node-test-pull-request/)**
and
**[citgm-smoker](https://ci.nodejs.org/job/citgm-smoker/)**
test run to ensure that the build is ready for release.

You can also manually test important modules from the ecosystem. Point npm and
node-gyp at your local branch to use the correct headers:

```bash
export npm_config_nodedir=</path/to/node>
```

### 8. Produce a Nightly Build _(optional)_

If there is a reason to produce a test release for the purpose of having others
try out installers or specifics of builds, produce a nightly build using
**[iojs+release](https://ci-release.nodejs.org/job/iojs+release/)** and wait for
it to drop in <https://nodejs.org/download/nightly/>. Follow the directions and
enter a proper length commit SHA, enter a date string, and select "nightly" for
"disttype".

```bash
# SHA:
git rev-parse --short v${VERSION}-proposal
# DATE:
DATE=${DATE}
```

This is particularly recommended if there has been recent work relating to the
macOS or Windows installers as they are not tested in any way by CI.

### 9. Produce Release Builds

Use **[iojs+release](https://ci-release.nodejs.org/job/iojs+release/)** to
produce release artifacts. Enter the commit that you want to build from and
select "release" for "disttype".

Artifacts from each worker are uploaded to Jenkins and are available if further
testing is required. Use this opportunity particularly to test macOS and Windows
installers if there are any concerns. Click through to the individual workers
for a run to find the artifacts.

All release workers should achieve "SUCCESS" (and be green, not red). A release
with failures should not be promoted as there are likely problems to be
investigated.

You can rebuild the release as many times as you need prior to promoting them if
you encounter problems.

If you have an error on Windows and need to start again, be aware that you'll
get immediate failure unless you wait up to 2 minutes for the linker to stop
from previous jobs. i.e. if a build fails after having started compiling, that
worker will still have a linker process that's running for another couple of
minutes which will prevent Jenkins from clearing the workspace to start a new
one. This isn't a big deal, it's just a hassle because it'll result in another
failed build if you start again!

ARMv7 takes the longest to compile. Unfortunately ccache isn't as effective on
release builds, I think it's because of the additional macro settings that go in
to a release build that nullify previous builds. Also most of the release build
machines are separate to the test build machines so they don't get any benefit
from ongoing compiles between releases. You can expect 1.5 hours for the ARMv7
builder to complete and you should normally wait for this to finish. It is
possible to rush a release out if you want and add additional builds later but
we normally provide ARMv7 from initial promotion.

You do not have to wait for the ARMv6 / Raspberry PI builds if they take longer
than the others. It is only necessary to have the main Linux (x64 and x86),
macOS .pkg and .tar.gz, Windows (x64 and x86) .msi and .exe, source, headers,
and docs (both produced currently by an macOS worker). **If you promote builds
_before_ ARM builds have finished, you must repeat the promotion step for the
ARM builds when they are ready**. If the ARMv6 build failed for some reason you
can use the
[`iojs-release-arm6-only`](https://ci-release.nodejs.org/job/iojs+release-arm6-only/)
build in the release CI to re-run the build only for ARMv6. When launching the
build make sure to use the same commit hash as for the original release.

### 10. Test the Build

You can download the built artifacts from the subjobs. Make sure that the build
appears correct. Check the version numbers, and perform some basic checks to
confirm that all is well with the build before moving forward. Use this
opportunity particularly to test macOS and Windows installers if there are any
concerns.

### 11. Tag and Sign the Release Commit

Once you have produced builds that you're happy with, create a new tag.

Tag summaries have a predictable format, look at a recent tag to see,
`git tag -v v6.0.0`. The message should be:
`${DATE} Node.js v${VERSION} ${CODENAME} (${RELEASE_TYPE}) Release`.

Install `git-secure-tag`:

```console
$ npm install -g git-secure-tag
```

Create a tag using the following command:

```console
$ git secure-tag <vx.y.z> <commit-sha> -sm 'YYYY-MM-DD Node.js vx.y.z (Release Type) Release'
```

The tag **must** be signed using the GPG key that's listed for you on the
project README.

**WARNING: This step is irreversible!**

Once you push this tag to GitHub, you ***should not*** delete and re-tag. If you
make a mistake after pushing then you'll have to version-bump and start again
and count that tag/version as lost. You might want to push the tag to your fork
first so you can check it looks okay.

Push the tag using the following command:

```console
$ git push <remote> v${RELEASE}
```

### 12. Set Up For the Next Release

On release proposal branch, edit `src/node_version.h` again and:

- Increment `NODE_PATCH_VERSION` by one
- Change `NODE_VERSION_IS_RELEASE` back to `0`

Commit this change with the following commit message format:

```txt
Working on v8.9.1 # Increment the patch number by 1.

PR-URL: <full URL to your release proposal PR>
```

This sets up the branch so that nightly builds are produced with the next
version number _and_ a pre-release tag.

Merge your release proposal branch into the `${BRANCH}`, and rebase
`${BRANCH}-staging` on top of that.

Cherry-pick the release commit to `master`, removing the `src/node_version.h`
changes.

```bash
git cherry-pick v${RELEASE} # From master.
git reset src/node_version.h
git checkout src/node_version.h
git cherry-pick --continue
git diff src/node_version.h # Confirm it's still 0.
```

Confirm `NODE_VERSION_IS_RELEASE` is still `0` and push to master.

### 13. Promote and Sign the Release Builds

**It is important that the same individual who signed the release tag be the one
to promote the builds as the SHASUMS256.txt file needs to be signed with the
same GPG key!**

Use `tools/release.sh` to promote and sign the build.

```console
tools/release.sh v${RELEASE}
```

When run, it will perform the following actions:

**a.** Select a GPG key from your private keys. It will use a command similar
to: `gpg --list-secret-keys` to list your keys. If you don't have any keys, it
will bail. (Why are you releasing? Your tag should be signed!) If you have only
one key, it will use that. If you have more than one key it will ask you to
select one from the list. Be sure to use the same key that you signed your git
tag with.

**b.** Log in to the server via SSH and check for releases that can be promoted,
along with the list of artifacts. It will use the `dist-promotable` command on
the server to find these. You will be asked, for each promotable release,
whether you want to proceed. If there is more than one release to promote (there
shouldn't be), be sure to only promote the release you are responsible for.

**c.** Log in to the server via SSH and run the promote script for the given
release. The command on the server will be similar to: `dist-promote v8.9.0`.
After this step, the release artifacts will be available for download and a
SHASUMS256.txt file will be present. The release will still be unsigned,
however.

**d.** Use `scp` to download SHASUMS256.txt to a temporary directory on your
computer.

**e.** Sign the SHASUMS256.txt file using a command similar to:
`gpg --default-key YOURKEY --clearsign /path/to/SHASUMS256.txt`. You will be
prompted by GPG for your password. The signed file will be named
SHASUMS256.txt.asc.

**f.** Output an ASCII armored version of your public GPG key using a command
similar to:
`gpg --default-key YOURKEY --armor --export --output /path/to/SHASUMS256.txt.gpg`
. This does not require your password and is mainly a convenience for users,
although not the recommended way to get a copy of your key.

**g.** Upload the SHASUMS256.txt files back to the server into the release
directory.

If you didn't wait for ARM builds in the previous step before promoting the
release, you should re-run `tools/release.sh` after the ARM builds have
finished. That will move the ARM artifacts into the correct location. You will
be prompted to re-sign SHASUMS256.txt.

*Note*: It is possible to only sign a release by running
`./tools/release.sh -s v${RELEASE}`.

### 14. Check the Release

Your release should be available at `https://nodejs.org/dist/v${RELEASE}/` and
<https://nodejs.org/dist/latest/>. Check that the appropriate files are in
place. You may want to check that the binaries are working as appropriate and
have the right internal version strings. Check that the API docs are available
at <https://nodejs.org/api/>. Check that the release catalog files are correct
at <https://nodejs.org/dist/index.tab> and <https://nodejs.org/dist/index.json>.

### 15. Create a Blog Post

There is an automatic build that is kicked off when you promote new builds, so
within a few minutes nodejs.org will be listing your new version as the latest
release. However, the blog post is not yet fully automatic.

Create a new blog post by running the [nodejs.org release-post.js script][].

  ```console
  Blog: vX.Y.Z release post

  Refs: <full URL to your release proposal PR>
  ```

- Changes to `master` on the nodejs.org repo will trigger a new build of
  nodejs.org so your changes should appear in a few minutes after pushing.

### 16. Announce

Tweet to announce the release, something like this is good:

> v5.8.0 of @nodejs is out: https://nodejs.org/en/blog/release/v5.8.0/
> …
> something here about notable changes

To ensure communication goes out with the timing of the blog post, please allow
24 hour prior notice. If known, please include the date and time the release
will be shared with the community in the email to coordinate these announcements.

### 16. Cleanup

Remove the proposal branch.

### 18. Celebrate

_In whatever form you do this..._

[nodejs.org release-post.js script]: https://github.com/nodejs/nodejs.org/blob/master/scripts/release-post.js
