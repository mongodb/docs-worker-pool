# Overview

This directory contains various build-time modules for use in makefiles or for use as published modules utilized in other CI/CD routines.
Each entry in this directory should NOT be coupled to another module, or code within the autobuilder.
It is the express intent of maintainers that each entry is standalone, and capable of being run or exported as needed with dependencies only within their constituent directories.
