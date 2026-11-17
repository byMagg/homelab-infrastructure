SHELL := /bin/bash
VENV := .venv
ANSIBLE := $(VENV)/bin/ansible
ANSIBLE_PLAYBOOK := $(VENV)/bin/ansible-playbook

.PHONY: ping base security pi verify phase0

ping:
	$(ANSIBLE) all -m ping

base:
	$(ANSIBLE_PLAYBOOK) ansible/playbooks/phase0.yml --tags base,sd,sysctl,unattended

security:
	$(ANSIBLE_PLAYBOOK) ansible/playbooks/phase0.yml --tags ssh,firewall,fail2ban

pi:
	$(ANSIBLE_PLAYBOOK) ansible/playbooks/phase0.yml --tags pi

verify:
	$(ANSIBLE_PLAYBOOK) ansible/playbooks/verify.yml

phase0: base security pi
