#!/bin/bash

cd src
cp firefox_manifest.json manifest.json
web-ext build
cd ..
