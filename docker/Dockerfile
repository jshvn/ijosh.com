# The toolbox: Hugo builds the site, Playwright's Chromium renders it for the visual check,
# Pillow diffs the screenshots, and node runs the field and meta scripts. Every task runs in
# here with the repo at /work, on a laptop and in CI alike.
#
# The base is Microsoft's Playwright image, pinned by digest: it fixes Chromium, the fonts and
# the system libraries, and so the pixels tests/visual/golden/ holds. A new digest means a
# `task visual:bless`. The playwright package must be the image's own version, since its
# browsers are the ones already in /ms-playwright.
FROM mcr.microsoft.com/playwright/python:v1.63.0-noble@sha256:72bd171a9ffc2b4b59532aaa6210e21014d07093120dc25528870c0b840da1f0

# HUGO_VERSION must equal HUGO_VERSION in jshvn/terraform (account/pages.tf), which Cloudflare
# Pages builds production with. On a bump, change the ARG and both of its sums together; read
# them from
#   https://github.com/gohugoio/hugo/releases/download/v$V/hugo_${V}_checksums.txt
#   https://nodejs.org/dist/v$V/SHASUMS256.txt
ARG HUGO_VERSION=0.166.0
ARG NODE_VERSION=24.21.0

RUN pip install --no-cache-dir playwright==1.63.0 pillow==12.3.0

# Architecture comes from the image, not a build arg: BuildKit sets TARGETARCH but Apple
# `container` does not, and a default would put amd64 binaries in an arm64 image.
RUN set -eu; \
    case "$(dpkg --print-architecture)" in \
      amd64) hugo_arch=amd64; node_arch=x64; \
             hugo_sha=0e39b901e3f919f1daae05c8ff64f0c14c8a348ef46886d63f8e6d1bb2653885; \
             node_sha=6e1db87ef58b8819e5d5402eff1536491b18edd8eb7bee5ef7897876e88dc5ff ;; \
      arm64) hugo_arch=arm64; node_arch=arm64; \
             hugo_sha=4b282afd8181e5ed182f50f293fc24dd6c42bfa569e555d53bfbc5ee6a1b2982; \
             node_sha=724282c3b43aec998aa9527380465b45d229e021b58035f5f4f63095eabfe5d5 ;; \
      *) echo "unsupported architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/hugo.tar.gz \
      "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-${hugo_arch}.tar.gz"; \
    echo "${hugo_sha}  /tmp/hugo.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/hugo.tar.gz -C /usr/local/bin hugo; \
    curl -fsSL -o /tmp/node.tar.gz \
      "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.gz"; \
    echo "${node_sha}  /tmp/node.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/node.tar.gz -C /usr/local --strip-components=1 "node-v${NODE_VERSION}-linux-${node_arch}/bin/node"; \
    rm /tmp/hugo.tar.gz /tmp/node.tar.gz

WORKDIR /work
