parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )

cd "$parent_path"
cd ../
cd build/api/controllers/v1/handlers

for FILE in *.js
do
  echo $FILE
  zip ${FILE%.*}.zip $FILE
  rm $FILE
done