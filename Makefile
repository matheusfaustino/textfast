build:
	web-ext build --source-dir='.' --artifacts-dir='build' --ignore-files '.*' '*.txt' Makefile export_mac_list.js test_list '*.sublime*' test.html test_media 'test_media/*'

run:
	web-ext lint && web-ext run
