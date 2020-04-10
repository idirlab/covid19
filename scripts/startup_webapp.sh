#!/bin/bash
# V1
# April 5th, 2020
# written by Josue Caraballo (josue.caraballo@mavs.uta.edu)
# This script should be run as a user.
# It:
#  1) runs from root of repo to start webapp
export HOST="0.0.0.0"
if [ -z "$1" ]; then
  export PORT=9090
else
  export PORT=8080
fi
http-server -a "$HOST" \
       	    -p $PORT 2>&1 > webapp.log & disown
