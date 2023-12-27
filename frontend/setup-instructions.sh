#!/bin/bash


git clone --depth 1 git@github.com:flatpak/flatpak.github.io.git

cp flatpak.github.io/data/distro.yml src/data/distro.yml

# Use yq to get the length of the array in the YAML file
length=$(yq 'length' src/data/distro.yml)

# Remove the old file
rm src/components/setup/Distros.tsx

# Iterate over each element in the array
for ((i=0; i<$length; i++))
do
  # Extract the name of the current element
  name=$(yq ".[$i].name" src/data/distro.yml)
  logo=$(yq -r ".[$i].logo" src/data/distro.yml)

  original_name=$(echo $name | tr -d '"/')
  # Remove non file name characters
  name=$(echo $name | tr -d '"/' | tr ' ' '_' | tr -d "!")
  # Make sure the name starts with an uppercase letter
  name=$(echo $name | sed 's/^[a-z]/\U&/')

  slug_name=$(echo $name | tr '[:upper:]' '[:lower:]')

  introduction=$(yq -r ".[$i].introduction" src/data/distro.yml)
  steps=$(yq ".[$i].steps" src/data/distro.yml)

  if [ "$steps" != "null" ]
  then
    echo "<HowToJsonLd" >> "src/components/setup/${slug_name}.tsx"
    echo "name=\"$original_name\"" >> "src/components/setup/${slug_name}.tsx"
    echo "image=\"https://flathub.org/img/distro/$logo\"" >> "src/components/setup/${slug_name}.tsx"
    echo "estimatedCost={{ currency: 'USD', value: '0' }}" >> "src/components/setup/${slug_name}.tsx"
    echo "step={[" >> "src/components/setup/${slug_name}.tsx"
    for ((j=0; j<$(yq ".[$i].steps | length" src/data/distro.yml); j++))
    do
      step_name=$(yq -r .[$i].steps[$j].name src/data/distro.yml)
      step_text=$(yq -r .[$i].steps[$j].text src/data/distro.yml)
      # Remove html tags from step_text
      step_text=$(echo $step_text | sed 's/<[^>]*>//g')
      # Escape single quotes
      step_text=$(echo $step_text | sed "s/'/\\\'/g")

      echo "{url: 'https://flathub.org/setup/$slug_name', name: '$step_name', itemListElement: [" >> "src/components/setup/${slug_name}.tsx"
      echo "{type: 'HowToDirection', text: '$step_text'}," >> "src/components/setup/${slug_name}.tsx"
      echo "]}" >> "src/components/setup/${slug_name}.tsx"
      if [ $j -ne $(yq ".[$i].steps | length" src/data/distro.yml) ]
      then
        echo "," >> "src/components/setup/${slug_name}.tsx"
      fi
    done
    echo "]}" >> "src/components/setup/${slug_name}.tsx"
    echo "/>" >> "src/components/setup/${slug_name}.tsx"
  fi

  # Write the introduction to a temporary file
  if [ "$introduction" != "null" ]
  then
    echo "<p>$introduction</p>" >> "src/components/setup/${slug_name}.tsx"
  fi


  # Append the steps to the temporary file
  if [ "$steps" != "null" ]
  then
    for ((j=0; j<$(yq ".[$i].steps | length" src/data/distro.yml); j++))
    do
      step_name=$(yq -r .[$i].steps[$j].name src/data/distro.yml)
      step_text=$(yq -r .[$i].steps[$j].text src/data/distro.yml)
      echo " " >> "src/components/setup/${slug_name}.tsx"
      echo "<li>" >> "src/components/setup/${slug_name}.tsx"
      echo "<h2>$step_name</h2>" >> "src/components/setup/${slug_name}.tsx"
      echo "$step_text" >> "src/components/setup/${slug_name}.tsx"
      echo "</li>" >> "src/components/setup/${slug_name}.tsx"
    done
  fi

  # Convert comment to JSX comment
  sed -i 's/<!--/{\/* /g' "src/components/setup/${slug_name}.tsx"
  sed -i 's/-->/ *\/}/g' "src/components/setup/${slug_name}.tsx"


  # Replace all \" with "
  sed -i 's/\\\"/\"/g' "src/components/setup/${slug_name}.tsx"


  # Replace class= with className=
  sed -i 's/class=/className=/g' "src/components/setup/${slug_name}.tsx"

  # Prefix with export const Name =
  sed -i "1s/^/export const ${name} = () => <ol className='distrotut'>\n/" "src/components/setup/${slug_name}.tsx"

  # Use sed to replace <terminal-command> tags with <CodeCopy text={...} />
  sed -i 's/<terminal-command>/<CodeCopy text={`/g' "src/components/setup/${slug_name}.tsx"
  sed -i 's/<\/terminal-command>/`} \/>/g' "src/components/setup/${slug_name}.tsx"

  sed -i "$ a\</ol>" "src/components/setup/${slug_name}.tsx"

  # Postfix with distroMap.set("Fedora", <Fedora />)
  sed -i "$ a\distroMap.set(\"${original_name}\", <${name} \/>);" "src/components/setup/${slug_name}.tsx"

  # Concat to shared file and a newline

  cat "src/components/setup/${slug_name}.tsx" >> src/components/setup/Distros.tsx
  echo "" >> src/components/setup/Distros.tsx

  # Remove temporary file
  rm "src/components/setup/${slug_name}.tsx"
done


# Prefix with import CodeCopy from "src/components/application/CodeCopy"; and a newline
sed -i "1s/^/import CodeCopy from \"src\/components\/application\/CodeCopy\";\n/" "src/components/setup/Distros.tsx"
sed -i "1s/^/import { HowToJsonLd } from \"next-seo\";\n/" "src/components/setup/Distros.tsx"

# Prefix with export const distroMap = new Map<string, JSX.Element>()
sed -i "1s/^/export const distroMap = new Map<string, JSX.Element>();\n/" "src/components/setup/Distros.tsx"

npx prettier --write src/components/setup/*.tsx

cp -r flatpak.github.io/source/img/distro public/img

rm -rf flatpak.github.io
