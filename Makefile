build:
	npm run build
	web-ext build --source-dir='.' --artifacts-dir='build' --ignore-files '.*' '*.txt' Makefile export_mac_list.js test_list '*.sublime*' test.html test_media 'test_media/*' src node_modules package.json package-lock.json build.js  textfast.ferdium.js textfast.user.js

run:
	npm run build && web-ext lint && web-ext run

watch:
	node build.js --watch
