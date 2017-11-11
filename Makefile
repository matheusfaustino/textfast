build:
	web-ext build --source-dir='.' --artifacts-dir='build' --ignore-files '.*' example.json '*.txt' Makefile export_mac_list.js test_list '*.sublime*'

run:
	web-ext lint && web-ext run --firefox-profile=default-1466116381487
