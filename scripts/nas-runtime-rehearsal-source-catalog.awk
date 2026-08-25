/^-- Name: .*; Type: TABLE; Schema: public;/ {
  name = $0
  sub(/^-- Name: /, "", name)
  sub(/; Type: TABLE; Schema: public;.*/, "", name)
  print "table|" name
}

/^-- Name: .*; Type: FUNCTION; Schema: public;/ {
  name = $0
  sub(/^-- Name: /, "", name)
  sub(/; Type: FUNCTION; Schema: public;.*/, "", name)
  gsub(/, /, ",", name)
  print "function|public." name
}

/^-- Name: .*; Type: POLICY; Schema: public;/ {
  name = $0
  sub(/^-- Name: /, "", name)
  sub(/; Type: POLICY; Schema: public;.*/, "", name)
  separator = index(name, " ")
  print "policy|" substr(name, 1, separator - 1) "|" substr(name, separator + 1)
}

/^-- Name: .*; Type: ROW SECURITY; Schema: public;/ {
  name = $0
  sub(/^-- Name: /, "", name)
  sub(/; Type: ROW SECURITY; Schema: public;.*/, "", name)
  print "rls|" name
}

/^-- Name: .*; Type: TRIGGER; Schema: public;/ {
  name = $0
  sub(/^-- Name: /, "", name)
  sub(/; Type: TRIGGER; Schema: public;.*/, "", name)
  separator = index(name, " ")
  print "trigger|" substr(name, 1, separator - 1) "|" substr(name, separator + 1)
}
