#!/bin/bash
# V1
# April 5th, 2020
# written by Josue Caraballo (josue.caraballo@mavs.uta.edu)
# This script should be run as a user.
# It:
#  1) swaps the url from the one running on 2222 to the one running on 3333
perl -pi -E "s/covid-19-api-dev/covid-19-api-dev-2/g" js/interactive.js
