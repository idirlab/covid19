#!/bin/bash
# V1
# March 29, 2020
# written by Josue Caraballo (josue.caraballo@mavs.uta.edu)
# This script should be run as sudo on idir-server8.
# It:
#  1) Reads a config file to identify a private key to send to git for authentication
#  2) Pulls updates from git
# Runs every day at 2AM
# Assumes master branch is set
#cd /home/zhengyuan/Projects/covid19data
source gittoken.env
BRANCH=master
git stash
git checkout $BRANCH
rm -rf covid19data
git clone git@github.com:idirlab/covid19data.git
rm -rf assets/COVID_data_collection
mv covid19data/COVID_data_collection assets

