.PHONY: scrub
scrub:
ifndef STORE
	$(error STORE is required: make scrub STORE=<domain>)
endif
	rm -rf "data/$(STORE)" "artifacts/$(STORE)"
	@echo "scrubbed data/$(STORE) and artifacts/$(STORE)"
