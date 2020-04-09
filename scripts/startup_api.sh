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
nohup sh -c "python3 app.py"&>api.log&
