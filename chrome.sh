#!/bin/bash

cd src
cp chrome_manifest.json manifest.json
cd ..

cp -r src chrome_extension
rm -rf chrome_extension/web-ext-artifacts/
rm extension.zip
zip -r extension.zip chrome_extension
rm -rf chrome_extension
