#!/bin/sh
DATE=`date "+%Y-%m-%d%H:%M:%S"`
#last build gets a file
LOGDIR="logs"
LOG_LASTBUILD="${LOGDIR}/lastbuild.log"
LOG_ARCHIVE="${LOGDIR}/build.archive.log.${DATE}"

[ -d $LOGDIR ] || mkdir $LOGDIR
[ -f $LOG_LASTBUILD ] &&  mv $LOG_LASTBUILD $LOG_ARCHIVE

cd $LOGDIR && ls -t | sed -e '1,5d' | xargs -d '\n' sudo rm; cd ..

{

#prune old containers
sudo docker system prune --all --force

#pull and build new images
cd docker && sudo rm -rf docs-worker-pool
git clone https://github.com/mongodb/docs-worker-pool.git && cd docs-worker-pool \
        && git checkout stage && git pull \
        && git show --pretty=format:"The author of %h was %an, %ai%nThe title was >>%s" --shortstat \
        && sudo cp ../../rundocker.sh . && sudo cp Dockerfile.xlarge Dockerfile \
        && sudo docker build --tag workertest . \
        && sudo docker stop $(sudo docker ps --filter ancestor=workertest | awk '{print $1}') \
        && sudo ./rundocker.sh

} > $LOG_LASTBUILD

