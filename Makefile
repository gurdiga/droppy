# os deps: node git jq docker

JQUERY_FLAGS:=-ajax,-css,-deprecated,-effects,-event/alias,-event/focusin,-event/trigger,-wrap,-core/ready,-deferred,-exports/amd,-sizzle,-offset,-dimensions,-serialize,-queue,-callbacks,-event/support,-event/ajax,-attributes/prop,-attributes/val,-attributes/attr,-attributes/support,-manipulation/support,-manipulation/var/rcheckableType

dev:
	node droppy.js start --dev

run:
	node droppy.js start

lint:
	npx eslint server client/client.js droppy.js
	# npx stylelint client/*.css

unit:
	node --test

test: lint unit

build:
	@touch client/client.js
	node droppy.js build

publish:
	if git ls-remote --exit-code origin &>/dev/null; then git push -u -f --tags origin master; fi
	if git ls-remote --exit-code git &>/dev/null; then git push -u -f --tags git master; fi
	npm publish

docker:
	@rm -rf node_modules
	npm ci --omit=dev
	$(eval IMAGE := silverwind/droppy)
	$(eval VERSION := $(shell cat package.json | jq -r .version))
	$(eval ARCHS := "linux/amd64,linux/arm64,linux/arm/v7,linux/arm/v6")
	@docker rm -f "$$(docker ps -a -f='ancestor=$(IMAGE)' -q)" 2>/dev/null || true
	@docker rmi "$$(docker images -qa $(IMAGE))" 2>/dev/null || true
	@docker buildx rm builder &>/dev/null || true
	@docker buildx create --name builder --use &>/dev/null || true
	docker buildx build --pull --push --platform $(ARCHS) -t $(IMAGE):$(VERSION) .
	docker buildx build --pull --push --platform $(ARCHS) -t $(IMAGE):latest .
	@docker buildx rm builder  &>/dev/null || true
	npm install

deps:
	rm -rf node_modules
	npm install

update:
	npx updates -u
	@$(MAKE) --no-print-directory deps
	@touch client/client.js

jquery:
	rm -rf /tmp/jquery
	git clone --depth 1 https://github.com/jquery/jquery /tmp/jquery
	cd /tmp/jquery; npm install; npx grunt; npx grunt custom:$(JQUERY_FLAGS); npx grunt remove_map_comment
	cat /tmp/jquery/dist/jquery.min.js | perl -pe 's|"3\..+?"|"3"|' > $(CURDIR)/client/jquery-custom.min.js
	rm -rf /tmp/jquery

ver-patch:
	npx versions -C patch

ver-minor:
	npx versions -C minor

ver-major:
	npx versions -C major

patch: test build ver-patch docker publish
minor: test build ver-minor docker publish
major: test build ver-major docker publish

.PHONY: dev run lint unit test publish docker deps update jquery version-patch version-minor version-major patch minor major

start:
	node droppy start --dev
s: start

edit:
	code -n .

e: edit

install:
	npm i

i: install
