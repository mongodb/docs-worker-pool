declare local var.mapUrl STRING;
set var.mapUrl = regsuball(req.url.path, "/core/", "");

if (table.lookup(redirect_map, var.mapUrl)) {
  error 718 "redirect";
}
