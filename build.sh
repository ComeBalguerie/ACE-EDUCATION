#!/bin/sh
rm -rf public
mkdir -p public/eleves
cp ./*.html ./*.js public/
cp eleves.html public/eleves/index.html
