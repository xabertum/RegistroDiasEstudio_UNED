package es.uned.estudio.repository;

import es.uned.estudio.model.Tema;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TemaRepository extends JpaRepository<Tema, Long> {

    List<Tema> findByAsignaturaIdOrderByOrdenAsc(Long asignaturaId);
}
