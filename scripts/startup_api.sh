#!/bin/bash
# V1
# March 29, 2020
# written by Josue Caraballo (josue.caraballo@mavs.uta.edu)
# This script should be run as a user.
# It:
#  1) cds to the right dir
#  2) runs the api
cd api
# python3 app.py 2>&1 > api.log & disown
if [ -z "$1" ]; then
  export PORT=3333
else
  export PORT=2222
fi
nohup sh -c "python3 app.py $PORT"&>api.log&
