#!/usr/bin/env bash
node example1.js 8081 &
node example1.js 8082 &
node example1.js 8083 &
node example1.js 8084 &
node loadbalancer.js  
