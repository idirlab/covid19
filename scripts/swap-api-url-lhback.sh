#!/bin/bash
# V1
# April 5th, 2020
# written by Josue Caraballo (josue.caraballo@mavs.uta.edu)
# This script should be run as a user.
# It:
#  1) swaps the url from the one running on 2222 to the one running on 3333
perl -pi -E "s/http\:\/\/localhost\:3333/https\:\/\/idir\.uta\.edu\/covid-19-api-dev/g" js/interactive.js
