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

  original_name=$(echo $name | tr -d '"/')
  # Remove non file name characters
  name=$(echo $name | tr -d '"/' | tr ' ' '_' | tr -d "!")
  # Make sure the name starts with an uppercase letter
  name=$(echo $name | sed 's/^[a-z]/\U&/')

  slug_name=$(echo $name | tr '[:upper:]' '[:lower:]')

  info=$(yq ".[$i].info" src/data/distro.yml)

  # Write the info to a temporary file
  echo "$info" > "src/components/setup/${slug_name}.tsx"


  # Remove the first and last characters from the file
  # (the first and last characters are the quotes)
  sed -i '1s/^.//' "src/components/setup/${slug_name}.tsx"
  sed -i '$ s/.$//' "src/components/setup/${slug_name}.tsx"

  # Replace all >\n with >
  sed -i 's/>\\n/>/g' "src/components/setup/${slug_name}.tsx"

  # Replace all :\n with :
  sed -i 's/:\\n/:/g' "src/components/setup/${slug_name}.tsx"

  # Convert comment to JSX comment
  sed -i 's/<!--/{\/* /g' "src/components/setup/${slug_name}.tsx"
  sed -i 's/-->/ *\/}/g' "src/components/setup/${slug_name}.tsx"


  # Replace all ' with \'
  sed -i "s/'/\\\'/g" "src/components/setup/${slug_name}.tsx"

  # Replace all \" with "
  sed -i 's/\\\"/\"/g' "src/components/setup/${slug_name}.tsx"


  # Replace class= with className=
  sed -i 's/class=/className=/g' "src/components/setup/${slug_name}.tsx"

  # Prefix with export const Name =
  sed -i "1s/^/export const ${name} = () => /" "src/components/setup/${slug_name}.tsx"

  # Use sed to replace <terminal-command> tags with <CodeCopy text={...} />
  sed -i 's/<terminal-command>\([^<]*\)<\/terminal-command>/<CodeCopy text={`\1`} \/>/g' "src/components/setup/${slug_name}.tsx"

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

# Prefix with export const distroMap = new Map<string, JSX.Element>()
sed -i "1s/^/export const distroMap = new Map<string, JSX.Element>();\n/" "src/components/setup/Distros.tsx"

npx prettier --write src/components/setup/*.tsx

cp -r flatpak.github.io/source/img/distro public/img

rm -rf flatpak.github.io
