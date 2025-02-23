# Flag to toggle warning suppression
disable_warnings=true

# Check if the user wants to disable warnings
while getopts ":d" opt; do
  case $opt in
    d)
      disable_warnings=true
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
  esac
done

if [ "$disable_warnings" = true ]; then
  # Save the current NODE_OPTIONS value
  original_node_options="$NODE_OPTIONS"

  # Set NODE_OPTIONS to disable warnings
  export NODE_OPTIONS='--no-warnings'
fi
echo "====================="
echo "eslint results"
echo "====================="
bun eslint . --fix

echo "====================="
echo "markdownlint results"
echo "====================="
bun markdownlint-cli2 '**/*.md' '!**/node_modules/**' '!**/licenses/**' --fix --config .markdownlint.json

echo "====================="
echo "Prettier results"
echo "====================="
bun prettier --write . | grep -v "unchanged"

echo "====================="
echo "All static analysis checks performed"
echo "====================="

# Reset NODE_OPTIONS to its original value on script exit if it was changed
if [ "$disable_warnings" = true ]; then
  trap 'export NODE_OPTIONS="$original_node_options"' EXIT
fi
