#!make
MAKEFLAGS += --silent

# This allows us to accept extra arguments (by doing nothing when we get a job that doesn't match, 
# rather than throwing an error).
%: 
    @: 


# $(MAKECMDGOALS) is the list of "targets" spelled out on the command line
stage: 
	node app.js $(filter-out $@,$(MAKECMDGOALS))


clean: 
	rm -rf build

.PHONY: stage
.PHONY: clean