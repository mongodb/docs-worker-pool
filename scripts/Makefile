#!make
MAKEFLAGS += --silent

# This allows us to accept extra arguments (by doing nothing when we get a job that doesn't match, 
# rather than throwing an error).
%: 
    @: 

# $(MAKECMDGOALS) is the list of "targets" spelled out on the command line
stage: 
	git clone --quiet https://github.com/madelinezec/test-submodules.git scripts
	@ cd scripts && npm list mongodb || npm install mongodb
	@ source ~/.config/.snootyenv && node scripts/app.js $(filter-out $@,$(MAKECMDGOALS))
	@ rm -rf scripts

commit:
        @:

local:
        @:

repo:
        @:

world:
        @:

clean: 
	rm -rf build

.PHONY: stage
.PHONY: clean
